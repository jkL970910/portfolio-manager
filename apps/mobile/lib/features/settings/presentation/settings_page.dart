import "package:flutter/material.dart";

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    required this.viewerName,
    required this.baseCurrency,
    required this.onDisplayCurrencyChanged,
    required this.onLogout,
    super.key,
  });

  final String viewerName;
  final String baseCurrency;
  final Future<void> Function(String currency) onDisplayCurrencyChanged;
  final VoidCallback onLogout;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late var _currency = widget.baseCurrency;
  var _savingCurrency = false;
  String? _error;

  Future<void> _changeCurrency(String currency) async {
    if (currency == _currency || _savingCurrency) {
      return;
    }

    setState(() {
      _savingCurrency = true;
      _error = null;
    });

    try {
      await widget.onDisplayCurrencyChanged(currency);
      if (mounted) {
        setState(() {
          _currency = currency;
          _savingCurrency = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _savingCurrency = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("设置", style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              title: Text(widget.viewerName),
              subtitle: const Text("Loo国居民档案"),
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            ),
          ),
          const SizedBox(height: 16),
          Text("显示币种", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: "CAD", label: Text("CAD")),
              ButtonSegment(value: "USD", label: Text("USD")),
            ],
            selected: {_currency},
            onSelectionChanged: _savingCurrency
                ? null
                : (value) => _changeCurrency(value.first),
          ),
          if (_savingCurrency) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          const Card(
            child: ListTile(
              leading: Icon(Icons.visibility_outlined),
              title: Text("观察列表与投资偏好"),
              subtitle: Text("后续接入 watchlist、风险偏好和目标配置。"),
            ),
          ),
          const Spacer(),
          FilledButton.tonalIcon(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
            label: const Text("退出 Loo国"),
          ),
        ],
      ),
    );
  }
}
