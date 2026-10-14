
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

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "api_task_definition_arn" {
  description = "ARN of the API task definition"
  value       = aws_ecs_task_definition.api.arn
}

output "public_subnet_ids" {
  description = "Public subnet IDs for ECS tasks"
  value       = aws_subnet.public[*].id
}

output "ecs_security_group_id" {
  description = "Security group ID assigned to ECS tasks"
  value       = aws_security_group.ecs.id
}