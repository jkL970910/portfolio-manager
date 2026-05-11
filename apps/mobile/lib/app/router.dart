import "package:flutter/material.dart";

import "../core/api/loo_api_client.dart";
import "../features/import_flow/presentation/import_page.dart";
import "../features/overview/presentation/overview_page.dart";
import "../features/portfolio/presentation/portfolio_page.dart";
import "../features/recommendations/presentation/recommendations_page.dart";
import "../features/settings/presentation/settings_page.dart";
import "../features/shared/presentation/loo_bottom_nav_bar.dart";

class MobileRootShellController extends ChangeNotifier {
  int _index = 0;
  PortfolioInitialSection? _portfolioInitialSection;
  int _portfolioSectionRequestToken = 0;

  int get index => _index;
  PortfolioInitialSection? get portfolioInitialSection =>
      _portfolioInitialSection;
  int get portfolioSectionRequestToken => _portfolioSectionRequestToken;

  void openTab(int index) {
    if (index == _index) {
      return;
    }
    _index = index;
    notifyListeners();
  }

  void openPortfolioSection(PortfolioInitialSection section) {
    _portfolioInitialSection = section;
    _portfolioSectionRequestToken += 1;
    _index = 1;
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
  int _portfolioSectionRequestToken = 0;

  @override
  void initState() {
    super.initState();
    _index = widget.controller?.index ?? _index;
    _portfolioSectionRequestToken =
        widget.controller?.portfolioSectionRequestToken ?? 0;
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
    _portfolioSectionRequestToken =
        widget.controller?.portfolioSectionRequestToken ?? 0;
    widget.controller?.addListener(_handleControllerChanged);
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_handleControllerChanged);
    super.dispose();
  }

  void _handleControllerChanged() {
    final nextIndex = widget.controller?.index ?? _index;
    final nextPortfolioSectionRequestToken =
        widget.controller?.portfolioSectionRequestToken ??
            _portfolioSectionRequestToken;
    if ((nextIndex == _index &&
            nextPortfolioSectionRequestToken ==
                _portfolioSectionRequestToken) ||
        !mounted) {
      return;
    }
    setState(() {
      _index = nextIndex;
      _portfolioSectionRequestToken = nextPortfolioSectionRequestToken;
    });
  }

  void _selectTab(int index) {
    widget.controller?.openTab(index);
    if (widget.controller == null) {
      setState(() => _index = index);
    }
  }

  void _openPortfolioSection(PortfolioInitialSection section) {
    widget.controller?.openPortfolioSection(section);
    if (widget.controller == null) {
      setState(() => _index = 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      OverviewPage(
        apiClient: widget.apiClient,
        onOpenAccounts: () => _openPortfolioSection(
          PortfolioInitialSection.accounts,
        ),
        onOpenHoldings: () => _openPortfolioSection(
          PortfolioInitialSection.holdings,
        ),
        onOpenRecommendations: () => _selectTab(2),
      ),
      PortfolioPage(
        apiClient: widget.apiClient,
        initialSection: widget.controller?.portfolioInitialSection,
        sectionRequestToken: _portfolioSectionRequestToken,
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
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Positioned.fill(child: pages[_index]),
            Positioned(
              left: 0,
              right: 0,
              bottom: 18,
              child: LooBottomNavBar(
                currentIndex: _index,
                onChanged: _selectTab,
                items: const [
                  LooBottomNavItem(icon: Icons.dashboard_rounded, label: "总览"),
                  LooBottomNavItem(
                    icon: Icons.account_balance_wallet_rounded,
                    label: "组合",
                  ),
                  LooBottomNavItem(
                      icon: Icons.auto_awesome_rounded, label: "推荐"),
                  LooBottomNavItem(
                      icon: Icons.upload_file_rounded, label: "导入"),
                  LooBottomNavItem(icon: Icons.settings_rounded, label: "设置"),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
