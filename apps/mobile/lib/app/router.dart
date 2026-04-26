import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../features/import_flow/presentation/import_page.dart";
import "../features/overview/presentation/overview_page.dart";
import "../features/portfolio/presentation/portfolio_page.dart";
import "../features/recommendations/presentation/recommendations_page.dart";
import "../features/settings/presentation/settings_page.dart";

class MobileRootShell extends StatefulWidget {
  const MobileRootShell({
    required this.apiClient,
    required this.viewerName,
    required this.onLogout,
    super.key,
  });

  final LooApiClient apiClient;
  final String viewerName;
  final VoidCallback onLogout;

  @override
  State<MobileRootShell> createState() => _MobileRootShellState();
}

class _MobileRootShellState extends State<MobileRootShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      OverviewPage(apiClient: widget.apiClient),
      PortfolioPage(apiClient: widget.apiClient),
      RecommendationsPage(apiClient: widget.apiClient),
      const ImportPage(),
      SettingsPage(
        viewerName: widget.viewerName,
        onLogout: widget.onLogout,
      ),
    ];

    return Scaffold(
      body: SafeArea(child: pages[_index]),
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
}
