import "package:flutter/material.dart";

import "../features/shared/presentation/loo_bottom_nav_bar.dart";
import "mobile_routes.dart";

class MobileRootShell extends StatelessWidget {
  const MobileRootShell({
    required this.currentIndex,
    required this.onTabSelected,
    required this.child,
    super.key,
  });

  final int currentIndex;
  final ValueChanged<int> onTabSelected;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Positioned.fill(child: child),
            Positioned(
              left: 0,
              right: 0,
              bottom: 18,
              child: LooBottomNavBar(
                currentIndex: currentIndex,
                onChanged: onTabSelected,
                items: const [
                  LooBottomNavItem(icon: Icons.dashboard_rounded, label: "总览"),
                  LooBottomNavItem(
                    icon: Icons.account_balance_wallet_rounded,
                    label: "组合",
                  ),
                  LooBottomNavItem(
                    icon: Icons.auto_awesome_rounded,
                    label: "推荐",
                  ),
                  LooBottomNavItem(
                    icon: Icons.upload_file_rounded,
                    label: "导入",
                  ),
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

String mobileRootPathForTab(int index) {
  return switch (index) {
    0 => MobileRoutes.overview,
    1 => MobileRoutes.portfolio,
    2 => MobileRoutes.recommendations,
    3 => MobileRoutes.importFlow,
    4 => MobileRoutes.settings,
    _ => MobileRoutes.overview,
  };
}
