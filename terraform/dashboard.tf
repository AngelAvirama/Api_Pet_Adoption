
resource "aws_cloudwatch_dashboard" "canary" {
  dashboard_name = "${var.project_name}-${var.environment}-canary-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2

        properties = {
          markdown = "# Canary Deployment Dashboard\nComparación de métricas entre Stable y Canary"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 12
        height = 6

        properties = {
          title   = "CPU - Stable vs Canary"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          period  = 300

          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.api.name, { label = "Stable CPU" }],
            [".", "CPUUtilization", ".", ".", "ServiceName", aws_ecs_service.canary.name, { label = "Canary CPU" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 2
        width  = 12
        height = 6

        properties = {
          title   = "Memoria - Stable vs Canary"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          period  = 300

          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.api.name, { label = "Stable Memory" }],
            [".", "MemoryUtilization", ".", ".", "ServiceName", aws_ecs_service.canary.name, { label = "Canary Memory" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 8
        width  = 12
        height = 6

        properties = {
          title   = "Solicitudes - Stable vs Canary"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          period  = 60
          stat    = "Sum"

          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.api.arn_suffix, "TargetGroup", aws_lb_target_group.api.arn_suffix, { label = "Stable Requests" }],
            [".", "RequestCount", ".", ".", "TargetGroup", aws_lb_target_group.canary.arn_suffix, { label = "Canary Requests" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 8
        width  = 12
        height = 6

        properties = {
          title   = "Errores HTTP 5xx - Stable vs Canary"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          period  = 60
          stat    = "Sum"

          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.api.arn_suffix, "TargetGroup", aws_lb_target_group.api.arn_suffix, { label = "Stable 5xx" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", "TargetGroup", aws_lb_target_group.canary.arn_suffix, { label = "Canary 5xx" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 14
        width  = 24
        height = 6

        properties = {
          title   = "Latencia p50, p95 y p99 - Target Groups"
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          period  = 60

          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.api.arn_suffix, "TargetGroup", aws_lb_target_group.api.arn_suffix, { id = "m1", label = "Stable p50", stat = "p50" }],
            [".", "TargetResponseTime", ".", ".", "TargetGroup", aws_lb_target_group.api.arn_suffix, { id = "m2", label = "Stable p95", stat = "p95" }],
            [".", "TargetResponseTime", ".", ".", "TargetGroup", aws_lb_target_group.api.arn_suffix, { id = "m3", label = "Stable p99", stat = "p99" }],
            [".", "TargetResponseTime", ".", ".", "TargetGroup", aws_lb_target_group.canary.arn_suffix, { id = "m4", label = "Canary p50", stat = "p50" }],
            [".", "TargetResponseTime", ".", ".", "TargetGroup", aws_lb_target_group.canary.arn_suffix, { id = "m5", label = "Canary p95", stat = "p95" }],
            [".", "TargetResponseTime", ".", ".", "TargetGroup", aws_lb_target_group.canary.arn_suffix, { id = "m6", label = "Canary p99", stat = "p99" }]
          ]
        }
      }
    ]
  })
}
