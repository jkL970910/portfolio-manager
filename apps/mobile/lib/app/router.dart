import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../features/import_flow/presentation/import_page.dart";
import "../features/overview/presentation/overview_page.dart";
import "../features/portfolio/presentation/portfolio_page.dart";
import "../features/recommendations/presentation/recommendations_page.dart";
import "../features/settings/presentation/settings_page.dart";
import "../features/shared/data/loo_minister_context_models.dart";
import "../features/shared/presentation/loo_minister_card.dart";

class MobileRootShell extends StatefulWidget {
  const MobileRootShell({
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
  State<MobileRootShell> createState() => _MobileRootShellState();
}

class _MobileRootShellState extends State<MobileRootShell> {
  int _index = 0;
  final Map<int, LooMinisterPageContext> _ministerContexts = {};

  void _rememberMinisterContext(int index, LooMinisterPageContext context) {
    if (!mounted) return;
    setState(() {
      _ministerContexts[index] = context;
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      OverviewPage(
        apiClient: widget.apiClient,
        onMinisterContextChanged: (context) => _rememberMinisterContext(
          0,
          context,
        ),
      ),
      PortfolioPage(
        apiClient: widget.apiClient,
        onMinisterContextChanged: (context) => _rememberMinisterContext(
          1,
          context,
        ),
      ),
      RecommendationsPage(apiClient: widget.apiClient),
      ImportPage(apiClient: widget.apiClient),
      SettingsPage(
        apiClient: widget.apiClient,
        viewerName: widget.viewerName,
        baseCurrency: widget.baseCurrency,
        onDisplayCurrencyChanged: widget.onDisplayCurrencyChanged,
        onLogout: widget.onLogout,
      ),
    ];

    return Scaffold(
      body: SafeArea(child: pages[_index]),
      floatingActionButton: LooMinisterFloatingButton(
        apiClient: widget.apiClient,
        pageContext: _ministerContexts[_index] ?? _fallbackMinisterContext,
        suggestedQuestion: _suggestedMinisterQuestion,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined), label: "总览"),
          NavigationDestination(
              icon: Icon(Icons.account_balance_wallet_outlined), label: "组合"),
          NavigationDestination(
              icon: Icon(Icons.auto_awesome_outlined), label: "推荐"),
          NavigationDestination(
              icon: Icon(Icons.upload_file_outlined), label: "导入"),
          NavigationDestination(
              icon: Icon(Icons.settings_outlined), label: "设置"),
        ],
      ),
    );
  }

  LooMinisterPageContext get _fallbackMinisterContext {
    final tab = _ministerTab(_index);
    return LooMinisterPageContext(
      page: tab.page,
      title: tab.title,
      asOf: DateTime.now().toUtc().toIso8601String(),
      displayCurrency: widget.baseCurrency,
      facts: [
        LooMinisterFact(
          id: "active-tab",
          label: "当前页面",
          value: tab.title,
          source: "system",
        ),
      ],
      warnings: const ["当前页面还没有完整结构化上下文，大臣会先按页面类型给出保守解释。"],
    );
  }

  String get _suggestedMinisterQuestion {
    return switch (_ministerTab(_index).page) {
      "overview" => "为什么总资产曲线和卡片数字可能不同？",
      "portfolio" => "当前组合最应该先检查什么？",
      "recommendations" => "这些推荐应该怎么优先看？",
      "import" => "手动导入时如何避免 CAD 和 USD 标的混淆？",
      "settings" => "我的投资偏好设置有什么需要注意？",
      _ => "这个页面我应该重点看什么？",
    };
  }

  _MinisterTab _ministerTab(int index) {
    return switch (index) {
      0 => const _MinisterTab(page: "overview", title: "Loo国总览"),
      1 => const _MinisterTab(page: "portfolio", title: "组合御览"),
      2 => const _MinisterTab(page: "recommendations", title: "推荐"),
      3 => const _MinisterTab(page: "import", title: "导入"),
      4 => const _MinisterTab(page: "settings", title: "设置"),
      _ => const _MinisterTab(page: "overview", title: "Loo国总览"),
    };
  }
}

class _MinisterTab {
  const _MinisterTab({required this.page, required this.title});

  final String page;
  final String title;
}
