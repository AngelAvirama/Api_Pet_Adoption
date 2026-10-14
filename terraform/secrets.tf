
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project_name}/${var.environment}/database-url"
  description             = "Database connection URL for the adoption API"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-${var.environment}-database-url"
  }
}

resource "aws_iam_role_policy" "ecs_read_database_secret" {
  name = "${var.project_name}-${var.environment}-read-database-secret"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.database_url.arn
    }]
  })
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id

  secret_string = "postgresql://${var.db_username}:${urlencode(var.db_password)}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}?schema=public"
}
