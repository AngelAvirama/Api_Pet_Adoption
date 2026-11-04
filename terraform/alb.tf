
resource "aws_lb" "api" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-${var.environment}-tg"
  port        = var.api_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-tg"
  }
}

resource "aws_lb_target_group" "canary" {
  name        = "${var.project_name}-${var.environment}-canary-tg"
  port        = var.api_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name  = "${var.project_name}-${var.environment}-canary-tg"
    Track = "canary"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  # Tráfico normal: Stable 100 %, Canary según la variable.
  default_action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.api.arn
        weight = 100 - var.canary_traffic_weight
      }

      target_group {
        arn    = aws_lb_target_group.canary.arn
        weight = var.canary_traffic_weight
      }
    }
  }
}

# Acceso interno para probar Canary, incluso cuando su peso es 0 %.
resource "aws_lb_listener_rule" "canary_internal" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  condition {
    http_header {
      http_header_name = "X-Canary"
      values           = ["true"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.canary.arn
  }
}

output "api_url" {
  description = "Public URL of the adoption API"
  value       = "http://${aws_lb.api.dns_name}"
}
