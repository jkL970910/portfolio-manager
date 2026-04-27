import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "portfolio_page.dart";

class AccountTypePortfolioPage extends StatelessWidget {
  const AccountTypePortfolioPage({
    required this.apiClient,
    required this.accountType,
    required this.title,
    super.key,
  });

  final LooApiClient apiClient;
  final String accountType;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: PortfolioPage(
        apiClient: apiClient,
        accountTypeFilter: accountType,
        title: title,
      ),
    );
  }
}
