
output "aws_region" {
  description = "AWS region selected for deployment"
  value       = var.aws_region
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "ecr_repository_url" {
  description = "URL of the API container repository"
  value       = aws_ecr_repository.api.repository_url
}

output "db_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "RDS PostgreSQL hostname"
  value       = aws_db_instance.main.address
}

output "db_name" {
  description = "PostgreSQL database name"
  value       = aws_db_instance.main.db_name
}
