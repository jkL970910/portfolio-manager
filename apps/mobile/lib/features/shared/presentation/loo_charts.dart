import "dart:math" as math;

import "package:flutter/material.dart";

class LooLineChartPoint {
  const LooLineChartPoint({
    required this.label,
    required this.value,
    this.displayValue,
  });

  final String label;
  final double value;
  final String? displayValue;
}

class LooTrendPoint {
  const LooTrendPoint({
    required this.label,
    required this.displayValue,
    required this.value,
    this.rawDate,
  });

  final String label;
  final String displayValue;
  final double value;
  final DateTime? rawDate;
}

class LooTrendChart extends StatefulWidget {
  const LooTrendChart({
    required this.title,
    required this.points,
    this.initialRange = LooTrendRange.threeMonths,
    super.key,
  });

  final String title;
  final List<LooTrendPoint> points;
  final LooTrendRange initialRange;

  @override
  State<LooTrendChart> createState() => _LooTrendChartState();
}

class _LooTrendChartState extends State<LooTrendChart> {
  late LooTrendRange _selectedRange = widget.initialRange;

  @override
  void didUpdateWidget(covariant LooTrendChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialRange != widget.initialRange) {
      _selectedRange = widget.initialRange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final allPoints = widget.points;
    final enabledRanges = {
      for (final range in LooTrendRange.values)
        range: _filteredPoints(allPoints, range).length >= 2,
    };
    if (enabledRanges[_selectedRange] != true) {
      _selectedRange = enabledRanges[LooTrendRange.ytd] == true
          ? LooTrendRange.ytd
          : LooTrendRange.values.firstWhere(
              (range) => enabledRanges[range] == true,
              orElse: () => LooTrendRange.ytd,
            );
    }
    final points = enabledRanges[_selectedRange] == true
        ? _filteredPoints(allPoints, _selectedRange)
        : allPoints;
    if (points.length < 2) {
      return const SizedBox.shrink();
    }

    final first = points.first;
    final last = points.last;
    final delta = last.value - first.value;
    final percent = first.value == 0 ? 0.0 : delta / first.value * 100;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final mutedColor = colorScheme.onSurface.withValues(alpha: 0.64);
    final positiveColor = colorScheme.tertiary;
    final negativeColor = colorScheme.error;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(widget.title, style: theme.textTheme.titleLarge),
            ),
            Text(
              last.displayValue,
              style: theme.textTheme.bodySmall?.copyWith(color: mutedColor),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: LooTrendRange.values.map((range) {
              final enabled = enabledRanges[range] == true;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(range.label),
                  selected: _selectedRange == range,
                  onSelected: enabled
                      ? (_) => setState(() => _selectedRange = range)
                      : null,
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 12),
        LooLineChart(
          points: points
              .map(
                (point) => LooLineChartPoint(
                  label: point.label,
                  value: point.value,
                  displayValue: point.displayValue,
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text(
                "${first.label} → ${last.label}",
                style: theme.textTheme.bodyMedium,
              ),
            ),
            Text(
              "${_selectedRange.label} ${_formatDelta(delta)} · ${_formatPercent(percent)}",
              style: theme.textTheme.bodyMedium?.copyWith(
                color: delta >= 0 ? positiveColor : negativeColor,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ],
    );
  }

  List<LooTrendPoint> _filteredPoints(
    List<LooTrendPoint> points,
    LooTrendRange range,
  ) {
    if (points.length < 2) return points;
    final datedPoints = points.where((point) => point.rawDate != null).toList();
    if (datedPoints.length < 2) {
      return range == LooTrendRange.ytd ? points : const [];
    }

    final latest = datedPoints
        .map((point) => point.rawDate!)
        .reduce((left, right) => left.isAfter(right) ? left : right);
    final cutoff = switch (range) {
      LooTrendRange.oneDay => latest.subtract(const Duration(days: 1)),
      LooTrendRange.oneWeek => latest.subtract(const Duration(days: 7)),
      LooTrendRange.oneMonth => latest.subtract(const Duration(days: 31)),
      LooTrendRange.threeMonths => latest.subtract(const Duration(days: 93)),
      LooTrendRange.sixMonths => latest.subtract(const Duration(days: 186)),
      LooTrendRange.oneYear => latest.subtract(const Duration(days: 366)),
      LooTrendRange.ytd => DateTime(latest.year),
    };
    return points
        .where((point) =>
            point.rawDate != null && !point.rawDate!.isBefore(cutoff))
        .toList();
  }

  String _formatDelta(double value) {
    final sign = value >= 0 ? "+" : "-";
    final absValue = value.abs();
    if (absValue >= 1000000) {
      return "$sign\$${(absValue / 1000000).toStringAsFixed(1)}M";
    }
    if (absValue >= 1000) {
      return "$sign\$${(absValue / 1000).toStringAsFixed(1)}k";
    }
    return "$sign\$${absValue.toStringAsFixed(0)}";
  }

  String _formatPercent(double value) {
    final sign = value >= 0 ? "+" : "";
    return "$sign${value.toStringAsFixed(1)}%";
  }
}

enum LooTrendRange {
  oneDay("1D"),
  oneWeek("1W"),
  oneMonth("1M"),
  threeMonths("3M"),
  sixMonths("6M"),
  oneYear("1Y"),
  ytd("YTD");

  const LooTrendRange(this.label);

  final String label;
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

class LooLineChart extends StatefulWidget {
  const LooLineChart({
    required this.points,
    this.height = 180,
    super.key,
  });

  final List<LooLineChartPoint> points;
  final double height;

  @override
  State<LooLineChart> createState() => _LooLineChartState();
}

class _LooLineChartState extends State<LooLineChart> {
  int? _selectedIndex;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (widget.points.length < 2) {
      return _EmptyChart(height: widget.height, label: "暂无趋势数据");
    }

    return SizedBox(
      width: double.infinity,
      height: widget.height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (details) {
              final index = _LineChartGeometry.nearestPointIndex(
                localPosition: details.localPosition,
                size: Size(constraints.maxWidth, widget.height),
                pointCount: widget.points.length,
              );
              setState(() => _selectedIndex = index);
            },
            onPanDown: (details) {
              final index = _LineChartGeometry.nearestPointIndex(
                localPosition: details.localPosition,
                size: Size(constraints.maxWidth, widget.height),
                pointCount: widget.points.length,
              );
              setState(() => _selectedIndex = index);
            },
            onPanUpdate: (details) {
              final index = _LineChartGeometry.nearestPointIndex(
                localPosition: details.localPosition,
                size: Size(constraints.maxWidth, widget.height),
                pointCount: widget.points.length,
              );
              if (index != _selectedIndex) {
                setState(() => _selectedIndex = index);
              }
            },
            child: CustomPaint(
              size: Size(constraints.maxWidth, widget.height),
              painter: _LineChartPainter(
                points: widget.points,
                selectedIndex: _selectedIndex,
                lineColor: theme.colorScheme.primary,
                fillColor: theme.colorScheme.primary.withValues(alpha: 0.12),
                gridColor: theme.colorScheme.outlineVariant,
                labelColor: theme.colorScheme.onSurfaceVariant,
                tooltipColor: theme.colorScheme.surfaceContainerHighest,
                tooltipTextColor: theme.colorScheme.onSurface,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LineChartGeometry {
  static const leftPadding = 52.0;
  static const rightPadding = 12.0;
  static const topPadding = 26.0;
  static const bottomPadding = 30.0;

  static double chartWidth(Size size) {
    return math.max(1.0, size.width - leftPadding - rightPadding);
  }

  static double chartHeight(Size size) {
    return math.max(1.0, size.height - topPadding - bottomPadding);
  }

  static int nearestPointIndex({
    required Offset localPosition,
    required Size size,
    required int pointCount,
  }) {
    if (pointCount <= 1) return 0;
    final normalized =
        ((localPosition.dx - leftPadding) / chartWidth(size)).clamp(0.0, 1.0);
    return (normalized * (pointCount - 1)).round().clamp(0, pointCount - 1);
  }
}

class _LineChartPainter extends CustomPainter {
  const _LineChartPainter({
    required this.points,
    required this.selectedIndex,
    required this.lineColor,
    required this.fillColor,
    required this.gridColor,
    required this.labelColor,
    required this.tooltipColor,
    required this.tooltipTextColor,
  });

  final List<LooLineChartPoint> points;
  final int? selectedIndex;
  final Color lineColor;
  final Color fillColor;
  final Color gridColor;
  final Color labelColor;
  final Color tooltipColor;
  final Color tooltipTextColor;

  @override
  void paint(Canvas canvas, Size size) {
    final chartHeight = _LineChartGeometry.chartHeight(size);
    final chartWidth = _LineChartGeometry.chartWidth(size);
    const leftPadding = _LineChartGeometry.leftPadding;
    const rightPadding = _LineChartGeometry.rightPadding;
    const topPadding = _LineChartGeometry.topPadding;
    const bottomPadding = _LineChartGeometry.bottomPadding;
    final values = points.map((point) => point.value).toList();
    final minValue = values.reduce(math.min);
    final maxValue = values.reduce(math.max);
    final range = math.max(1.0, maxValue - minValue);

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    final axisFractions = [0.0, 0.5, 1.0];
    for (final fraction in axisFractions) {
      final y = topPadding + chartHeight * fraction;
      canvas.drawLine(
        Offset(leftPadding, y),
        Offset(size.width - rightPadding, y),
        gridPaint,
      );
      final value = maxValue - range * fraction;
      _paintText(
        canvas,
        _formatAxisValue(value),
        Offset(0, y - 7),
        labelColor,
        fontSize: 10,
      );
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

    _paintText(
      canvas,
      points.first.label,
      Offset(leftPadding, size.height - 22),
      labelColor,
    );
    _paintText(
      canvas,
      points.last.label,
      Offset(size.width - rightPadding, size.height - 22),
      labelColor,
      alignRight: true,
    );

    final selected = selectedIndex;
    if (selected != null && selected >= 0 && selected < offsets.length) {
      _paintSelectedPoint(canvas, size, offsets[selected], points[selected]);
    }
  }

  void _paintSelectedPoint(
    Canvas canvas,
    Size size,
    Offset offset,
    LooLineChartPoint point,
  ) {
    final guidePaint = Paint()
      ..color = lineColor.withValues(alpha: 0.42)
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(offset.dx, _LineChartGeometry.topPadding),
      Offset(offset.dx, size.height - _LineChartGeometry.bottomPadding),
      guidePaint,
    );
    canvas.drawCircle(
      offset,
      6,
      Paint()..color = lineColor.withValues(alpha: 0.18),
    );
    canvas.drawCircle(offset, 4, Paint()..color = lineColor);

    final value = point.displayValue ?? _formatAxisValue(point.value);
    final label = "${point.label} · $value";
    const tooltipHeight = 28.0;
    const horizontalPadding = 10.0;
    final textPainter = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: tooltipTextColor,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
      maxLines: 1,
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: size.width - 16);
    final tooltipWidth = textPainter.width + horizontalPadding * 2;
    final left = (offset.dx - tooltipWidth / 2)
        .clamp(4.0, size.width - tooltipWidth - 4);
    final top = math.max(0.0, offset.dy - tooltipHeight - 10);
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(left, top, tooltipWidth, tooltipHeight),
      const Radius.circular(14),
    );
    canvas.drawRRect(rect, Paint()..color = tooltipColor);
    textPainter.paint(
      canvas,
      Offset(left + horizontalPadding, top + 7),
    );
  }

  String _formatAxisValue(double value) {
    final absValue = value.abs();
    final sign = value < 0 ? "-" : "";
    if (absValue >= 1000000) {
      return "$sign\$${(absValue / 1000000).toStringAsFixed(1)}M";
    }
    if (absValue >= 1000) {
      return "$sign\$${(absValue / 1000).toStringAsFixed(0)}k";
    }
    return "$sign\$${absValue.toStringAsFixed(0)}";
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.selectedIndex != selectedIndex ||
        oldDelegate.lineColor != lineColor ||
        oldDelegate.fillColor != fillColor ||
        oldDelegate.gridColor != gridColor ||
        oldDelegate.labelColor != labelColor ||
        oldDelegate.tooltipColor != tooltipColor ||
        oldDelegate.tooltipTextColor != tooltipTextColor;
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
  bool alignRight = false,
  double fontSize = 11,
}) {
  final painter = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(color: color, fontSize: fontSize),
    ),
    maxLines: 1,
    textDirection: TextDirection.ltr,
  )..layout(maxWidth: 82);
  final dx = centered
      ? offset.dx - painter.width / 2
      : alignRight
          ? offset.dx - painter.width
          : offset.dx;
  final dy = centered ? offset.dy - painter.height / 2 : offset.dy;
  painter.paint(canvas, Offset(dx, dy));
}
