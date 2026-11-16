# Release 5: Chaos Engineering.
#
# - The chaos switch keeps its state in one SSM Parameter Store parameter
#   (created and deleted by the API at runtime, never by Terraform), so every
#   ECS task sees the same fault and the switch keeps working while the
#   database is down.
# - The task gets its own role (task role) allowed to touch only that
#   parameter: least privilege, separated from the execution role.
# - The switch token and the Grafana Cloud OTLP headers are secrets injected
#   by ECS from Secrets Manager, never plain environment variables.

locals {
  chaos_ssm_parameter     = "/${var.project_name}/${var.environment}/chaos-fault"
  chaos_ssm_parameter_arn = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.chaos_ssm_parameter}"
}

data "aws_caller_identity" "current" {}

resource "aws_secretsmanager_secret" "chaos_token" {
  name                    = "${var.project_name}/${var.environment}/chaos-token"
  description             = "Token of the chaos switch (X-Chaos-Token)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "chaos_token" {
  secret_id     = aws_secretsmanager_secret.chaos_token.id
  secret_string = var.chaos_token
}

resource "aws_secretsmanager_secret" "otel_headers" {
  name                    = "${var.project_name}/${var.environment}/otel-exporter-headers"
  description             = "OTLP headers (Authorization) for Grafana Cloud"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "otel_headers" {
  secret_id     = aws_secretsmanager_secret.otel_headers.id
  secret_string = var.otel_exporter_headers
}

resource "aws_iam_role_policy" "ecs_read_chaos_secrets" {
  name = "${var.project_name}-${var.environment}-read-chaos-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.chaos_token.arn,
        aws_secretsmanager_secret.otel_headers.arn
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_chaos_switch" {
  name = "${var.project_name}-${var.environment}-chaos-switch"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ssm:DeleteParameter"
      ]
      Resource = local.chaos_ssm_parameter_arn
    }]
  })
}
