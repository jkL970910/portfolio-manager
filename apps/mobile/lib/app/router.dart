import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../features/import_flow/presentation/import_page.dart";
import "../features/overview/presentation/overview_page.dart";
import "../features/portfolio/presentation/portfolio_page.dart";
import "../features/recommendations/presentation/recommendations_page.dart";
import "../features/settings/presentation/settings_page.dart";

class MobileRootShellController extends ChangeNotifier {
  int _index = 0;

  int get index => _index;

  void openTab(int index) {
    if (index == _index) {
      return;
    }
    _index = index;
    notifyListeners();
  }
}

class MobileRootShell extends StatefulWidget {
  const MobileRootShell({
    required this.apiClient,
    required this.viewerName,
    required this.baseCurrency,
    required this.onDisplayCurrencyChanged,
    required this.onLogout,
    this.controller,
    super.key,
  });

  final LooApiClient apiClient;
  final String viewerName;
  final String baseCurrency;
  final Future<void> Function(String currency) onDisplayCurrencyChanged;
  final VoidCallback onLogout;
  final MobileRootShellController? controller;

  @override
  State<MobileRootShell> createState() => _MobileRootShellState();
}

class _MobileRootShellState extends State<MobileRootShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _index = widget.controller?.index ?? _index;
    widget.controller?.addListener(_handleControllerChanged);
  }

  @override
  void didUpdateWidget(covariant MobileRootShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller == widget.controller) {
      return;
    }
    oldWidget.controller?.removeListener(_handleControllerChanged);
    _index = widget.controller?.index ?? _index;
    widget.controller?.addListener(_handleControllerChanged);
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_handleControllerChanged);
    super.dispose();
  }

  void _handleControllerChanged() {
    final nextIndex = widget.controller?.index ?? _index;
    if (nextIndex == _index || !mounted) {
      return;
    }
    setState(() => _index = nextIndex);
  }

  void _selectTab(int index) {
    widget.controller?.openTab(index);
    if (widget.controller == null) {
      setState(() => _index = index);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      OverviewPage(apiClient: widget.apiClient),
      PortfolioPage(apiClient: widget.apiClient),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _selectTab,
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
}
