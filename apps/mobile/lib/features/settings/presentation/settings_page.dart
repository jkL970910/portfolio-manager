import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    required this.apiClient,
    required this.viewerName,
    required this.baseCurrency,
    required this.onDisplayCurrencyChanged,
    required this.onLogout,
    super.key,
  });

  final LooApiClient apiClient;
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
  var _refreshingQuotes = false;
  String? _refreshResult;
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

  Future<void> _refreshQuotes() async {
    if (_refreshingQuotes) {
      return;
    }

    setState(() {
      _refreshingQuotes = true;
      _refreshResult = null;
      _error = null;
    });

    try {
      final response = await widget.apiClient.refreshPortfolioQuotes();
      final data = response["data"];
      final result =
          data is Map<String, dynamic> ? data : const <String, dynamic>{};
      final refreshed = result["refreshedHoldingCount"] ?? 0;
      final missing = result["missingQuoteCount"] ?? 0;
      final sampled = result["sampledSymbolCount"] ?? 0;
      if (mounted) {
        setState(() {
          _refreshResult =
              "已刷新 $refreshed 笔持仓；检查 $sampled 个标的身份，$missing 个暂未拿到报价。";
          _refreshingQuotes = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _refreshingQuotes = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
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
          Text("行情数据", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.sync),
              title: const Text("刷新组合行情"),
              subtitle: Text(
                _refreshResult ?? "按代码 + 交易所 + 币种刷新，避免 CAD 版本和美股正股混淆。",
              ),
              trailing: _refreshingQuotes
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.chevron_right),
              onTap: _refreshingQuotes ? null : _refreshQuotes,
            ),
          ),
          const SizedBox(height: 16),
          const Card(
            child: ListTile(
              leading: Icon(Icons.visibility_outlined),
              title: Text("观察列表与投资偏好"),
              subtitle: Text("后续接入 watchlist、风险偏好和目标配置。"),
            ),
          ),
          const SizedBox(height: 24),
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
