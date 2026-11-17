# Security game day, experiment 2 (exposure and segmentation, network layer).
#
# Round 0 (security_hardening_enabled = false): the controls as they were
# before the game day. CloudTrail only keeps its 90-day event history; nobody
# is alerted when a security group is opened, and egress is unfiltered.
#
# Round 1 (security_hardening_enabled = true), the two improvements:
#   1. Detection as code + autonomous containment: CloudTrail trail ->
#      EventBridge rule (pattern versioned in chaos/security/detecciones) ->
#      Lambda that revokes a public ingress on the private groups (ECS, RDS)
#      and alerts the owner by e-mail (SNS).
#   2. Deny by default and egress filtering (security_groups.tf).

locals {
  endurecido   = var.security_hardening_enabled ? 1 : 0
  deteccion_sg = jsondecode(file("${path.module}/../chaos/security/detecciones/01-sg-ingreso-publico.json"))
  deteccion_ad = jsondecode(file("${path.module}/../chaos/security/detecciones/02-acceso-directo-sin-alb.json"))
  lambda_name  = "${var.project_name}-${var.environment}-revocar-ingreso-publico"
}

# --- Signal source: CloudTrail management events -----------------------------

resource "aws_s3_bucket" "cloudtrail" {
  count         = local.endurecido
  bucket        = "${var.project_name}-${var.environment}-cloudtrail-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  count                   = local.endurecido
  bucket                  = aws_s3_bucket.cloudtrail[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  count  = local.endurecido
  bucket = aws_s3_bucket.cloudtrail[0].id

  rule {
    id     = "retencion-30-dias"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_policy" "cloudtrail" {
  count  = local.endurecido
  bucket = aws_s3_bucket.cloudtrail[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.cloudtrail[0].arn
      },
      {
        Sid       = "CloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.cloudtrail[0].arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = { StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" } }
      }
    ]
  })
}

resource "aws_cloudtrail" "gestion" {
  count                         = local.endurecido
  name                          = "${var.project_name}-${var.environment}-gestion"
  s3_bucket_name                = aws_s3_bucket.cloudtrail[0].id
  include_global_service_events = false
  is_multi_region_trail         = false
  enable_log_file_validation    = true

  depends_on = [aws_s3_bucket_policy.cloudtrail]
}

# --- Detection: EventBridge rule (pattern from the versioned detection) -------

resource "aws_cloudwatch_event_rule" "seguridad_sg" {
  count         = local.endurecido
  name          = "${var.project_name}-${var.environment}-seguridad-sg-publico"
  description   = local.deteccion_sg.titulo
  event_pattern = jsonencode(local.deteccion_sg.patron_eventbridge)
}

# Raw copy of every security group change, as evidence for the timeline
resource "aws_cloudwatch_log_group" "seguridad_eventos" {
  count             = local.endurecido
  name              = "/aws/events/${var.project_name}-${var.environment}-seguridad"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_resource_policy" "seguridad_eventos" {
  count       = local.endurecido
  policy_name = "${var.project_name}-${var.environment}-eventbridge-logs"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = ["events.amazonaws.com", "delivery.logs.amazonaws.com"] }
      Action    = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource  = "${aws_cloudwatch_log_group.seguridad_eventos[0].arn}:*"
    }]
  })
}

resource "aws_cloudwatch_event_target" "seguridad_eventos" {
  count = local.endurecido
  rule  = aws_cloudwatch_event_rule.seguridad_sg[0].name
  arn   = aws_cloudwatch_log_group.seguridad_eventos[0].arn
}

# --- Alert: e-mail to the owner of the network layer -------------------------

resource "aws_sns_topic" "seguridad" {
  count = local.endurecido
  name  = "${var.project_name}-${var.environment}-alertas-seguridad"
}

resource "aws_sns_topic_subscription" "seguridad_email" {
  count     = var.security_hardening_enabled && var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.seguridad[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# --- Detection in the workload layer: request that skipped the ALB ----------

resource "aws_cloudwatch_log_metric_filter" "acceso_directo" {
  count          = local.endurecido
  name           = "${var.project_name}-${var.environment}-acceso-directo-sin-alb"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = local.deteccion_ad.filtro_cloudwatch

  metric_transformation {
    name          = "AccesoDirectoSinAlb"
    namespace     = "PetAdoption/Seguridad"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "acceso_directo" {
  count               = local.endurecido
  alarm_name          = "${var.project_name}-${var.environment}-seguridad-acceso-directo-sin-alb"
  alarm_description   = local.deteccion_ad.titulo
  namespace           = "PetAdoption/Seguridad"
  metric_name         = "AccesoDirectoSinAlb"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.seguridad[0].arn]
  ok_actions          = [aws_sns_topic.seguridad[0].arn]
}

# --- Containment: Lambda with least privilege --------------------------------

data "archive_file" "revocar" {
  type        = "zip"
  source_dir  = "${path.module}/../security/lambda/revocar-ingreso-publico"
  output_path = "${path.module}/.build/revocar-ingreso-publico.zip"
}

resource "aws_cloudwatch_log_group" "revocar" {
  count             = local.endurecido
  name              = "/aws/lambda/${local.lambda_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "revocar" {
  count = local.endurecido
  name  = "${var.project_name}-${var.environment}-revocar-ingreso"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "revocar" {
  count = local.endurecido
  name  = "${var.project_name}-${var.environment}-revocar-ingreso"
  role  = aws_iam_role.revocar[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.revocar[0].arn}:*"
      },
      {
        Effect = "Allow"
        Action = ["ec2:RevokeSecurityGroupIngress"]
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/${aws_security_group.ecs.id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/${aws_security_group.rds.id}"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.seguridad[0].arn
      }
    ]
  })
}

resource "aws_lambda_function" "revocar" {
  count            = local.endurecido
  function_name    = local.lambda_name
  role             = aws_iam_role.revocar[0].arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.revocar.output_path
  source_code_hash = data.archive_file.revocar.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      PROTECTED_GROUPS = "${aws_security_group.ecs.id},${aws_security_group.rds.id}"
      REMEDIATION_MODE = "contener"
      ALERT_TOPIC_ARN  = aws_sns_topic.seguridad[0].arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.revocar, aws_iam_role_policy.revocar]
}

resource "aws_lambda_permission" "revocar" {
  count         = local.endurecido
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.revocar[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.seguridad_sg[0].arn
}

resource "aws_cloudwatch_event_target" "revocar" {
  count = local.endurecido
  rule  = aws_cloudwatch_event_rule.seguridad_sg[0].name
  arn   = aws_lambda_function.revocar[0].arn
}
