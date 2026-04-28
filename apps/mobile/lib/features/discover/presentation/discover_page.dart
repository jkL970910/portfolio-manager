import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../portfolio/presentation/security_detail_page.dart";

class DiscoverPage extends StatefulWidget {
  const DiscoverPage({
    required this.apiClient,
    super.key,
  });

  final LooApiClient apiClient;

  @override
  State<DiscoverPage> createState() => _DiscoverPageState();
}

class _DiscoverPageState extends State<DiscoverPage> {
  final _queryController = TextEditingController();
  var _searching = false;
  var _workingSymbol = "";
  var _searched = false;
  String? _error;
  String? _status;
  String? _providerStatus;
  Set<String> _watchlistSymbols = const {};
  List<MobileDiscoverSecurityCandidate> _results = const [];

  @override
  void initState() {
    super.initState();
    _loadWatchlist();
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _loadWatchlist() async {
    try {
      final response = await widget.apiClient.getInvestmentPreferences();
      final data = response["data"];
      final profile = data is Map<String, dynamic> ? data["profile"] : null;
      final symbols = profile is Map<String, dynamic>
          ? profile["watchlistSymbols"] as List?
          : null;
      if (mounted) {
        setState(() {
          _watchlistSymbols = symbols
                  ?.whereType<String>()
                  .map((symbol) => symbol.trim().toUpperCase())
                  .where((symbol) => symbol.isNotEmpty)
                  .toSet() ??
              const {};
        });
      }
    } catch (_) {
      // Search still works if the watchlist snapshot cannot be read.
    }
  }

  Future<void> _search() async {
    final query = _queryController.text.trim();
    if (query.isEmpty) {
      setState(() {
        _searched = true;
        _results = const [];
        _providerStatus = null;
        _status = null;
        _error = "先输入代码或名称。";
      });
      return;
    }

    setState(() {
      _searching = true;
      _searched = true;
      _error = null;
      _status = null;
      _providerStatus = null;
    });

    try {
      final response = await widget.apiClient.searchSecurities(query);
      final data = response["data"];
      final results = data is Map<String, dynamic> ? data["results"] : null;
      final providerHealth =
          data is Map<String, dynamic> ? data["providerHealth"] : null;
      final candidates = results is List
          ? results
              .whereType<Map<String, dynamic>>()
              .map(MobileDiscoverSecurityCandidate.fromJson)
              .where((candidate) => candidate.symbol.isNotEmpty)
              .toList()
          : <MobileDiscoverSecurityCandidate>[];

      if (mounted) {
        setState(() {
          _results = candidates;
          _searching = false;
          _status = candidates.isEmpty
              ? "没有找到匹配标的。可以换一个代码或公司名。"
              : "找到 ${candidates.length} 个候选结果。";
          _providerStatus = _formatProviderStatus(providerHealth);
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _searching = false;
        });
      }
    }
  }

  Future<void> _toggleWatchlist(
      MobileDiscoverSecurityCandidate candidate) async {
    final symbol = candidate.normalizedSymbol;
    if (symbol.isEmpty || _workingSymbol.isNotEmpty) {
      return;
    }

    final tracked = _watchlistSymbols.contains(symbol);
    setState(() {
      _workingSymbol = symbol;
      _error = null;
    });

    try {
      final response = tracked
          ? await widget.apiClient.removeWatchlistSymbol(symbol)
          : await widget.apiClient.addWatchlistSymbol(symbol);
      final data = response["data"];
      final symbols = data is Map<String, dynamic>
          ? data["watchlistSymbols"] as List?
          : null;

      if (mounted) {
        setState(() {
          if (symbols != null) {
            _watchlistSymbols = symbols
                .whereType<String>()
                .map((entry) => entry.trim().toUpperCase())
                .where((entry) => entry.isNotEmpty)
                .toSet();
          } else if (tracked) {
            _watchlistSymbols = {..._watchlistSymbols}..remove(symbol);
          } else {
            _watchlistSymbols = {..._watchlistSymbols, symbol};
          }
          _workingSymbol = "";
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tracked ? "$symbol 已移出观察列表。" : "$symbol 已加入观察列表。"),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _workingSymbol = "";
        });
      }
    }
  }

  void _openSecurityDetail(MobileDiscoverSecurityCandidate candidate) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SecurityDetailPage(
          apiClient: widget.apiClient,
          symbol: candidate.symbol,
          fallbackTitle: candidate.symbol,
          exchange: candidate.exchange,
          currency: candidate.currency,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadWatchlist,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
        children: [
          const _PageHeader(
            title: "标的发现台",
            subtitle: "搜索股票、ETF 或 CDR，确认交易所和币种后再加入观察或打开详情。",
          ),
          const SizedBox(height: 16),
          _SearchCard(
            controller: _queryController,
            searching: _searching,
            onSearch: _search,
          ),
          if (_watchlistSymbols.isNotEmpty) ...[
            const SizedBox(height: 16),
            _WatchlistPreview(symbols: _watchlistSymbols.toList()..sort()),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            _MessageCard(message: _error!, isError: true),
          ],
          if (_status != null) ...[
            const SizedBox(height: 16),
            _MessageCard(message: _status!),
          ],
          if (_providerStatus != null) ...[
            const SizedBox(height: 8),
            Text(_providerStatus!,
                style: Theme.of(context).textTheme.bodySmall),
          ],
          const SizedBox(height: 16),
          if (_searching)
            const Center(child: CircularProgressIndicator())
          else if (_searched && _results.isEmpty)
            const _EmptyState()
          else
            ..._results.map(
              (candidate) => _SecurityResultCard(
                candidate: candidate,
                tracked: _watchlistSymbols.contains(candidate.normalizedSymbol),
                working: _workingSymbol == candidate.normalizedSymbol,
                onToggleWatchlist: () => _toggleWatchlist(candidate),
                onOpenDetail: () => _openSecurityDetail(candidate),
              ),
            ),
        ],
      ),
    );
  }
}

class MobileDiscoverSecurityCandidate {
  const MobileDiscoverSecurityCandidate({
    required this.symbol,
    required this.name,
    required this.type,
    required this.provider,
    this.exchange,
    this.currency,
    this.country,
  });

  final String symbol;
  final String name;
  final String type;
  final String provider;
  final String? exchange;
  final String? currency;
  final String? country;

  String get normalizedSymbol => symbol.trim().toUpperCase();

  String get identityLine => [
        if (exchange != null && exchange!.isNotEmpty) exchange!,
        if (currency != null && currency!.isNotEmpty) currency!,
        if (country != null && country!.isNotEmpty) country!,
        type,
        provider,
      ].where((item) => item.isNotEmpty).join(" · ");

  factory MobileDiscoverSecurityCandidate.fromJson(Map<String, dynamic> json) {
    return MobileDiscoverSecurityCandidate(
      symbol: json["symbol"] as String? ?? "",
      name: json["name"] as String? ?? "未知标的",
      type: json["type"] as String? ?? "Unknown",
      provider: json["provider"] as String? ?? "unknown",
      exchange: json["exchange"] as String?,
      currency: json["currency"] as String?,
      country: json["country"] as String?,
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _SearchCard extends StatelessWidget {
  const _SearchCard({
    required this.controller,
    required this.searching,
    required this.onSearch,
  });

  final TextEditingController controller;
  final bool searching;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: controller,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "代码或名称",
                hintText: "例如 VFV、AAPL、Amazon",
                prefixIcon: Icon(Icons.search),
              ),
              onSubmitted: (_) => searching ? null : onSearch(),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: searching ? null : onSearch,
              icon: const Icon(Icons.manage_search),
              label: Text(searching ? "搜索中..." : "搜索标的"),
            ),
          ],
        ),
      ),
    );
  }
}

class _WatchlistPreview extends StatelessWidget {
  const _WatchlistPreview({required this.symbols});

  final List<String> symbols;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("当前观察列表", style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: symbols
                  .take(20)
                  .map((symbol) => Chip(label: Text(symbol)))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _SecurityResultCard extends StatelessWidget {
  const _SecurityResultCard({
    required this.candidate,
    required this.tracked,
    required this.working,
    required this.onToggleWatchlist,
    required this.onOpenDetail,
  });

  final MobileDiscoverSecurityCandidate candidate;
  final bool tracked;
  final bool working;
  final VoidCallback onToggleWatchlist;
  final VoidCallback onOpenDetail;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  child: Text(
                    candidate.normalizedSymbol.length > 3
                        ? candidate.normalizedSymbol.substring(0, 3)
                        : candidate.normalizedSymbol,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        candidate.normalizedSymbol,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(candidate.name),
                      if (candidate.identityLine.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(candidate.identityLine,
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: working ? null : onToggleWatchlist,
                  icon: Icon(tracked
                      ? Icons.bookmark_added
                      : Icons.bookmark_add_outlined),
                  label: Text(working
                      ? "处理中..."
                      : tracked
                          ? "移出观察"
                          : "加入观察"),
                ),
                OutlinedButton.icon(
                  onPressed: onOpenDetail,
                  icon: const Icon(Icons.open_in_new),
                  label: const Text("打开详情"),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message, this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Text(
          message,
          style: TextStyle(
            color: isError ? Theme.of(context).colorScheme.error : null,
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(18),
        child: Text("还没有可展示的结果。换一个代码或公司名再试。"),
      ),
    );
  }
}

String? _formatProviderStatus(Object? providerHealth) {
  if (providerHealth is! Map<String, dynamic>) {
    return null;
  }

  final twelve = providerHealth["twelveDataConfigured"] == true;
  final yahoo = providerHealth["yahooFinanceConfigured"] == true;
  final openFigi = providerHealth["openFigiConfigured"] == true;
  final active = [
    if (twelve) "Twelve Data",
    if (yahoo) "Yahoo Finance",
    if (openFigi) "OpenFIGI",
  ];

  return active.isEmpty
      ? "当前没有配置实时搜索 provider，可能只返回 fallback 结果。"
      : "搜索来源：${active.join("、")}。";
}
