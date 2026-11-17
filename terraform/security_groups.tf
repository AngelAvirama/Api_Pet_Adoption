
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Allow HTTP traffic to the application load balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Round 0: unfiltered egress, as before the game day
  dynamic "egress" {
    for_each = var.security_hardening_enabled ? [] : [1]
    content {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # Round 1: the ALB only talks to the tasks, on the app port. CIDRs of the
  # task subnets instead of the ECS group, to avoid a reference cycle.
  dynamic "egress" {
    for_each = var.security_hardening_enabled ? [1] : []
    content {
      description = "Only to the tasks (app port)"
      from_port   = var.api_port
      to_port     = var.api_port
      protocol    = "tcp"
      cidr_blocks = aws_subnet.public[*].cidr_block
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-${var.environment}-ecs-sg"
  description = "Allow traffic from the load balancer to ECS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API traffic from ALB"
    from_port       = var.api_port
    to_port         = var.api_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Round 0: unfiltered egress, as before the game day
  dynamic "egress" {
    for_each = var.security_hardening_enabled ? [] : [1]
    content {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # Round 1, deny by default: HTTPS only (ECR, Secrets Manager, SSM,
  # CloudWatch Logs, Grafana Cloud) and PostgreSQL only to the database
  # subnets. Anything else (plain HTTP, SSH, other ports) is dropped.
  dynamic "egress" {
    for_each = var.security_hardening_enabled ? [1] : []
    content {
      description = "HTTPS to AWS APIs and Grafana Cloud"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  dynamic "egress" {
    for_each = var.security_hardening_enabled ? [1] : []
    content {
      description = "PostgreSQL only to the database subnets"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = aws_subnet.private[*].cidr_block
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Allow PostgreSQL traffic only from ECS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}
