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
  late final PageController _pageController;
  var _selectedMode = _LooTrendChartMode.amount;
  var _page = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void didUpdateWidget(covariant LooTrendChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialRange != widget.initialRange) {
      _selectedRange = widget.initialRange;
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final allPoints = _normalizeSeries(widget.points);
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
    final monthlyReturns = _monthlyReturns(allPoints);
    final pages = <Widget>[
      _TrendLinePanel(
        points: points,
        selectedMode: _selectedMode,
        selectedRange: _selectedRange,
        enabledRanges: enabledRanges,
        first: first,
        last: last,
        delta: delta,
        percent: percent,
        positiveColor: positiveColor,
        negativeColor: negativeColor,
        onModeChanged: (mode) => setState(() => _selectedMode = mode),
        onRangeChanged: (range) => setState(() => _selectedRange = range),
      ),
      _MonthlyReturnPanel(
        months: monthlyReturns,
        year: monthlyReturns.isNotEmpty
            ? monthlyReturns.last.month.year
            : DateTime.now().year,
      ),
    ];

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
        SizedBox(
          height: 286,
          child: PageView(
            controller: _pageController,
            onPageChanged: (value) => setState(() => _page = value),
            children: pages,
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: _TrendCarouselDots(
            count: pages.length,
            activeIndex: _page,
          ),
        ),
      ],
    );
  }

  List<_MonthlyReturn> _monthlyReturns(List<LooTrendPoint> points) {
    final datedPoints = points.where((point) => point.rawDate != null).toList();
    if (datedPoints.length < 2) return const [];
    final byMonth = <DateTime, List<LooTrendPoint>>{};
    for (final point in datedPoints) {
      final rawDate = point.rawDate!;
      final month = DateTime(rawDate.year, rawDate.month);
      byMonth.putIfAbsent(month, () => <LooTrendPoint>[]).add(point);
    }

    final months = byMonth.entries.toList()
      ..sort((left, right) => left.key.compareTo(right.key));
    return months.map((entry) {
      final monthPoints = entry.value
        ..sort((left, right) => left.rawDate!.compareTo(right.rawDate!));
      final first = monthPoints.first;
      final last = monthPoints.last;
      return _MonthlyReturn(
        month: entry.key,
        delta: last.value - first.value,
        percent: first.value == 0
            ? 0
            : (last.value - first.value) / first.value * 100,
        hasData: monthPoints.length >= 2,
      );
    }).toList();
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
    final filtered = points
        .where((point) =>
            point.rawDate != null && !point.rawDate!.isBefore(cutoff))
        .toList();
    if (range == LooTrendRange.oneDay) {
      return filtered;
    }
    if (range == LooTrendRange.oneWeek) {
      return _compressToHourlyClosingPoints(filtered);
    }
    return _compressToDailyClosingPoints(filtered);
  }

  List<LooTrendPoint> _normalizeSeries(List<LooTrendPoint> points) {
    final sorted = [...points]..sort((left, right) {
        final leftDate = left.rawDate;
        final rightDate = right.rawDate;
        if (leftDate == null && rightDate == null) return 0;
        if (leftDate == null) return -1;
        if (rightDate == null) return 1;
        return leftDate.compareTo(rightDate);
      });
    final byTimestamp = <int, LooTrendPoint>{};
    for (final point in sorted) {
      final key = point.rawDate?.millisecondsSinceEpoch ?? point.label.hashCode;
      byTimestamp[key] = point;
    }
    return byTimestamp.values.toList()
      ..sort((left, right) {
        final leftDate = left.rawDate;
        final rightDate = right.rawDate;
        if (leftDate == null && rightDate == null) return 0;
        if (leftDate == null) return -1;
        if (rightDate == null) return 1;
        return leftDate.compareTo(rightDate);
      });
  }

  List<LooTrendPoint> _compressToDailyClosingPoints(
      List<LooTrendPoint> points) {
    if (points.length < 2) return points;
    final byDay = <DateTime, LooTrendPoint>{};
    for (final point in points) {
      final rawDate = point.rawDate;
      if (rawDate == null) continue;
      final day = DateTime(rawDate.year, rawDate.month, rawDate.day);
      final existing = byDay[day];
      if (existing == null ||
          (existing.rawDate != null && rawDate.isAfter(existing.rawDate!))) {
        byDay[day] = point;
      }
    }
    final compressed = byDay.entries.toList()
      ..sort((left, right) => left.key.compareTo(right.key));
    return compressed.map((entry) => entry.value).toList();
  }

  List<LooTrendPoint> _compressToHourlyClosingPoints(
      List<LooTrendPoint> points) {
    if (points.length < 2) return points;
    final byHour = <DateTime, LooTrendPoint>{};
    for (final point in points) {
      final rawDate = point.rawDate;
      if (rawDate == null) continue;
      final hour =
          DateTime(rawDate.year, rawDate.month, rawDate.day, rawDate.hour);
      final existing = byHour[hour];
      if (existing == null ||
          (existing.rawDate != null && rawDate.isAfter(existing.rawDate!))) {
        byHour[hour] = point;
      }
    }
    final compressed = byHour.entries.toList()
      ..sort((left, right) => left.key.compareTo(right.key));
    return compressed.map((entry) => entry.value).toList();
  }
}

class _TrendLinePanel extends StatelessWidget {
  const _TrendLinePanel({
    required this.points,
    required this.selectedMode,
    required this.selectedRange,
    required this.enabledRanges,
    required this.first,
    required this.last,
    required this.delta,
    required this.percent,
    required this.positiveColor,
    required this.negativeColor,
    required this.onModeChanged,
    required this.onRangeChanged,
  });

  final List<LooTrendPoint> points;
  final _LooTrendChartMode selectedMode;
  final LooTrendRange selectedRange;
  final Map<LooTrendRange, bool> enabledRanges;
  final LooTrendPoint first;
  final LooTrendPoint last;
  final double delta;
  final double percent;
  final Color positiveColor;
  final Color negativeColor;
  final ValueChanged<_LooTrendChartMode> onModeChanged;
  final ValueChanged<LooTrendRange> onRangeChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final chartPoints = selectedMode == _LooTrendChartMode.percent
        ? _asPercentPoints(points)
        : points
            .map(
              (point) => LooLineChartPoint(
                label: point.label,
                value: point.value,
                displayValue: point.displayValue,
              ),
            )
            .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Spacer(),
            _TrendModeSwitch(
              selectedMode: selectedMode,
              onChanged: onModeChanged,
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 176,
          child: LooLineChart(
            points: chartPoints,
            axisValueFormatter: selectedMode == _LooTrendChartMode.percent
                ? _formatAxisPercent
                : null,
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: LooTrendRange.values.map((range) {
              final enabled = enabledRanges[range] == true;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(range.label),
                  selected: selectedRange == range,
                  onSelected: enabled ? (_) => onRangeChanged(range) : null,
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: Text(
                "${first.label} → ${last.label}",
                style: theme.textTheme.bodyMedium,
              ),
            ),
            Text(
              "${selectedRange.label} ${_formatDelta(delta)} · ${_formatPercent(percent)}",
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

  List<LooLineChartPoint> _asPercentPoints(List<LooTrendPoint> points) {
    final base = points.first.value;
    if (base == 0) {
      return points
          .map(
            (point) => LooLineChartPoint(
              label: point.label,
              value: 0,
              displayValue: "${point.displayValue} · 0.0%",
            ),
          )
          .toList();
    }

    return points.map((point) {
      final value = (point.value - base) / base * 100;
      return LooLineChartPoint(
        label: point.label,
        value: value,
        displayValue: "${point.displayValue} · ${_formatPercent(value)}",
      );
    }).toList();
  }

  String _formatAxisPercent(double value) {
    final sign = value > 0 ? "+" : "";
    return "$sign${value.toStringAsFixed(1)}%";
  }
}

class _MonthlyReturnPanel extends StatelessWidget {
  const _MonthlyReturnPanel({
    required this.months,
    required this.year,
  });

  final List<_MonthlyReturn> months;
  final int year;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final byMonth = {
      for (final item in months)
        if (item.month.year == year) item.month.month: item,
    };
    final total = months
        .where((item) => item.month.year == year && item.hasData)
        .fold<double>(0, (sum, item) => sum + item.delta);
    final totalColor =
        total >= 0 ? theme.colorScheme.tertiary : theme.colorScheme.error;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Row(
          children: [
            Icon(Icons.chevron_left, color: theme.colorScheme.onSurfaceVariant),
            Expanded(
              child: Column(
                children: [
                  Text(
                    "$year 年",
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    _formatDelta(total),
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: totalColor,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant),
          ],
        ),
        const SizedBox(height: 14),
        Expanded(
          child: GridView.builder(
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              childAspectRatio: 1.45,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: 12,
            itemBuilder: (context, index) {
              final month = index + 1;
              return _MonthlyReturnTile(
                month: month,
                item: byMonth[month],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MonthlyReturnTile extends StatelessWidget {
  const _MonthlyReturnTile({
    required this.month,
    required this.item,
  });

  final int month;
  final _MonthlyReturn? item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final data = item;
    final hasData = data != null && data.hasData;
    final isPositive = (data?.delta ?? 0) >= 0;
    final isLatest = hasData &&
        data.month.year == DateTime.now().year &&
        data.month.month == DateTime.now().month;
    final foreground = isLatest
        ? Colors.white
        : hasData
            ? (isPositive ? colorScheme.tertiary : colorScheme.error)
            : colorScheme.onSurfaceVariant.withValues(alpha: 0.56);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: isLatest
            ? colorScheme.primary
            : colorScheme.surfaceContainerHighest.withValues(
                alpha: hasData ? 0.58 : 0.22,
              ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isLatest
              ? colorScheme.primary
              : colorScheme.outlineVariant.withValues(alpha: 0.42),
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              "$month月",
              style: theme.textTheme.titleSmall?.copyWith(
                color: foreground,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              hasData ? _formatDelta(data.delta) : "-",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelMedium?.copyWith(
                color: foreground,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthlyReturn {
  const _MonthlyReturn({
    required this.month,
    required this.delta,
    required this.percent,
    required this.hasData,
  });

  final DateTime month;
  final double delta;
  final double percent;
  final bool hasData;
}

class _TrendCarouselDots extends StatelessWidget {
  const _TrendCarouselDots({
    required this.count,
    required this.activeIndex,
  });

  final int count;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (index) {
        final active = index == activeIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 28 : 9,
          height: 9,
          decoration: BoxDecoration(
            color: active
                ? colorScheme.primary
                : colorScheme.outlineVariant.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(999),
          ),
        );
      }),
    );
  }
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

enum _LooTrendChartMode {
  amount("金额"),
  percent("收益率");

  const _LooTrendChartMode(this.label);

  final String label;
}

class _TrendModeSwitch extends StatelessWidget {
  const _TrendModeSwitch({
    required this.selectedMode,
    required this.onChanged,
  });

  final _LooTrendChartMode selectedMode;
  final ValueChanged<_LooTrendChartMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.64),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: 0.7),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: _LooTrendChartMode.values.map((mode) {
          final selected = selectedMode == mode;
          return InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => onChanged(mode),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: selected
                    ? colorScheme.primary.withValues(alpha: 0.22)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                mode.label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: selected
                      ? colorScheme.primary
                      : colorScheme.onSurfaceVariant,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
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
    this.axisValueFormatter,
    super.key,
  });

  final List<LooLineChartPoint> points;
  final double height;
  final String Function(double value)? axisValueFormatter;

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
                axisValueFormatter: widget.axisValueFormatter,
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
    required this.axisValueFormatter,
    required this.lineColor,
    required this.fillColor,
    required this.gridColor,
    required this.labelColor,
    required this.tooltipColor,
    required this.tooltipTextColor,
  });

  final List<LooLineChartPoint> points;
  final int? selectedIndex;
  final String Function(double value)? axisValueFormatter;
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
    final formatter = axisValueFormatter;
    if (formatter != null) {
      return formatter(value);
    }
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
        oldDelegate.axisValueFormatter != axisValueFormatter ||
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
    this.showLabels = true,
    super.key,
  });

  final List<LooRadarPoint> points;
  final double height;
  final bool showLabels;

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
          showLabels: showLabels,
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
    required this.showLabels,
  });

  final List<LooRadarPoint> points;
  final Color axisColor;
  final Color fillColor;
  final Color strokeColor;
  final Color labelColor;
  final bool showLabels;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final edgePadding = showLabels ? 38.0 : 12.0;
    final radius =
        math.max(0.0, math.min(size.width, size.height) / 2 - edgePadding);
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

      if (showLabels) {
        final labelPoint =
            center + Offset(math.cos(angle), math.sin(angle)) * (radius + 22);
        _paintText(canvas, points[index].label, labelPoint, labelColor,
            centered: true);
      }
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
        oldDelegate.labelColor != labelColor ||
        oldDelegate.showLabels != showLabels;
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
