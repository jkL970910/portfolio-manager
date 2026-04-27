import "dart:math" as math;

import "package:flutter/material.dart";

class LooLineChartPoint {
  const LooLineChartPoint({
    required this.label,
    required this.value,
  });

  final String label;
  final double value;
}

class LooDistributionSegment {
  const LooDistributionSegment({
    required this.label,
    required this.value,
    this.color,
  });

  final String label;
  final double value;
  final Color? color;
}

class LooRadarPoint {
  const LooRadarPoint({
    required this.label,
    required this.value,
  });

  final String label;
  final double value;
}

class LooLineChart extends StatelessWidget {
  const LooLineChart({
    required this.points,
    this.height = 180,
    super.key,
  });

  final List<LooLineChartPoint> points;
  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (points.length < 2) {
      return _EmptyChart(height: height, label: "暂无趋势数据");
    }

    return SizedBox(
      height: height,
      child: CustomPaint(
        painter: _LineChartPainter(
          points: points,
          lineColor: theme.colorScheme.primary,
          fillColor: theme.colorScheme.primary.withValues(alpha: 0.12),
          gridColor: theme.colorScheme.outlineVariant,
          labelColor: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class LooDistributionBar extends StatelessWidget {
  const LooDistributionBar({
    required this.segments,
    this.height = 16,
    super.key,
  });

  final List<LooDistributionSegment> segments;
  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = segments.fold<double>(
      0,
      (sum, segment) => sum + math.max(0, segment.value),
    );
    if (total <= 0 || segments.isEmpty) {
      return const _EmptyChart(height: 72, label: "暂无配置数据");
    }

    final colors = [
      theme.colorScheme.primary,
      theme.colorScheme.tertiary,
      theme.colorScheme.secondary,
      theme.colorScheme.error,
      theme.colorScheme.inversePrimary,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(height),
          child: Row(
            children: [
              for (var index = 0; index < segments.length; index++)
                Expanded(
                  flex: math.max(
                    1,
                    ((math.max(0, segments[index].value) / total) * 1000)
                        .round(),
                  ),
                  child: ColoredBox(
                    color:
                        segments[index].color ?? colors[index % colors.length],
                    child: SizedBox(height: height),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 8,
          children: [
            for (var index = 0; index < segments.length; index++)
              _LegendPill(
                color: segments[index].color ?? colors[index % colors.length],
                label:
                    "${segments[index].label} ${(segments[index].value / total * 100).round()}%",
              ),
          ],
        ),
      ],
    );
  }
}

class LooRadarChart extends StatelessWidget {
  const LooRadarChart({
    required this.points,
    this.height = 220,
    super.key,
  });

  final List<LooRadarPoint> points;
  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (points.length < 3) {
      return _EmptyChart(height: height, label: "暂无雷达数据");
    }

    return SizedBox(
      height: height,
      child: CustomPaint(
        painter: _RadarChartPainter(
          points: points,
          axisColor: theme.colorScheme.outlineVariant,
          fillColor: theme.colorScheme.primary.withValues(alpha: 0.16),
          strokeColor: theme.colorScheme.primary,
          labelColor: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _LineChartPainter extends CustomPainter {
  const _LineChartPainter({
    required this.points,
    required this.lineColor,
    required this.fillColor,
    required this.gridColor,
    required this.labelColor,
  });

  final List<LooLineChartPoint> points;
  final Color lineColor;
  final Color fillColor;
  final Color gridColor;
  final Color labelColor;

  @override
  void paint(Canvas canvas, Size size) {
    const leftPadding = 4.0;
    const topPadding = 10.0;
    const bottomPadding = 30.0;
    final chartHeight = size.height - topPadding - bottomPadding;
    final chartWidth = size.width - leftPadding;
    final values = points.map((point) => point.value).toList();
    final minValue = values.reduce(math.min);
    final maxValue = values.reduce(math.max);
    final range = math.max(1, maxValue - minValue);

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (final fraction in [0.25, 0.5, 0.75]) {
      final y = topPadding + chartHeight * fraction;
      canvas.drawLine(Offset(leftPadding, y), Offset(size.width, y), gridPaint);
    }

    final offsets = <Offset>[];
    for (var index = 0; index < points.length; index++) {
      final x = leftPadding + chartWidth * index / (points.length - 1);
      final y = topPadding +
          chartHeight * (1 - ((points[index].value - minValue) / range));
      offsets.add(Offset(x, y));
    }

    final path = Path()..moveTo(offsets.first.dx, offsets.first.dy);
    for (final offset in offsets.skip(1)) {
      path.lineTo(offset.dx, offset.dy);
    }

    final fillPath = Path.from(path)
      ..lineTo(offsets.last.dx, size.height - bottomPadding)
      ..lineTo(offsets.first.dx, size.height - bottomPadding)
      ..close();
    canvas.drawPath(fillPath, Paint()..color = fillColor);
    canvas.drawPath(
      path,
      Paint()
        ..color = lineColor
        ..strokeWidth = 3
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    final dotPaint = Paint()..color = lineColor;
    for (final offset in offsets) {
      canvas.drawCircle(offset, 3, dotPaint);
    }

    _paintText(canvas, points.first.label,
        Offset(leftPadding, size.height - 22), labelColor);
    _paintText(canvas, points.last.label,
        Offset(size.width - 72, size.height - 22), labelColor);
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.lineColor != lineColor ||
        oldDelegate.fillColor != fillColor ||
        oldDelegate.gridColor != gridColor ||
        oldDelegate.labelColor != labelColor;
  }
}

class _RadarChartPainter extends CustomPainter {
  const _RadarChartPainter({
    required this.points,
    required this.axisColor,
    required this.fillColor,
    required this.strokeColor,
    required this.labelColor,
  });

  final List<LooRadarPoint> points;
  final Color axisColor;
  final Color fillColor;
  final Color strokeColor;
  final Color labelColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 38;
    final axisPaint = Paint()
      ..color = axisColor
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    for (final fraction in [0.33, 0.66, 1.0]) {
      final ring = _polygonPath(center, radius * fraction);
      canvas.drawPath(ring, axisPaint);
    }

    final dataPath = Path();
    for (var index = 0; index < points.length; index++) {
      final angle = -math.pi / 2 + 2 * math.pi * index / points.length;
      final axisEnd =
          center + Offset(math.cos(angle), math.sin(angle)) * radius;
      canvas.drawLine(center, axisEnd, axisPaint);

      final normalized = points[index].value.clamp(0, 100) / 100;
      final dataPoint = center +
          Offset(math.cos(angle), math.sin(angle)) * radius * normalized;
      if (index == 0) {
        dataPath.moveTo(dataPoint.dx, dataPoint.dy);
      } else {
        dataPath.lineTo(dataPoint.dx, dataPoint.dy);
      }

      final labelPoint =
          center + Offset(math.cos(angle), math.sin(angle)) * (radius + 22);
      _paintText(canvas, points[index].label, labelPoint, labelColor,
          centered: true);
    }
    dataPath.close();

    canvas.drawPath(dataPath, Paint()..color = fillColor);
    canvas.drawPath(
      dataPath,
      Paint()
        ..color = strokeColor
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round,
    );
  }

  Path _polygonPath(Offset center, double radius) {
    final path = Path();
    for (var index = 0; index < points.length; index++) {
      final angle = -math.pi / 2 + 2 * math.pi * index / points.length;
      final point = center + Offset(math.cos(angle), math.sin(angle)) * radius;
      if (index == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    return path..close();
  }

  @override
  bool shouldRepaint(covariant _RadarChartPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.axisColor != axisColor ||
        oldDelegate.fillColor != fillColor ||
        oldDelegate.strokeColor != strokeColor ||
        oldDelegate.labelColor != labelColor;
  }
}

class _LegendPill extends StatelessWidget {
  const _LegendPill({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _EmptyChart extends StatelessWidget {
  const _EmptyChart({required this.height, required this.label});

  final double height;
  final String label;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Center(
        child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
      ),
    );
  }
}

void _paintText(
  Canvas canvas,
  String text,
  Offset offset,
  Color color, {
  bool centered = false,
}) {
  final painter = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(color: color, fontSize: 11),
    ),
    maxLines: 1,
    textDirection: TextDirection.ltr,
  )..layout(maxWidth: 82);
  final dx = centered ? offset.dx - painter.width / 2 : offset.dx;
  final dy = centered ? offset.dy - painter.height / 2 : offset.dy;
  painter.paint(canvas, Offset(dx, dy));
}
