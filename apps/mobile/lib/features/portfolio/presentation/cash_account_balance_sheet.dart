import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/mobile_portfolio_models.dart";

Future<bool> showCashAccountBalanceSheet({
  required BuildContext context,
  required LooApiClient apiClient,
  required MobilePortfolioCashAccount account,
}) async {
  final updated = await showLooFloatingSheet<bool>(
    context: context,
    builder: (context) => _CashAccountBalanceSheet(
      apiClient: apiClient,
      account: account,
    ),
  );
  return updated == true;
}

class _CashAccountBalanceSheet extends StatefulWidget {
  const _CashAccountBalanceSheet({
    required this.apiClient,
    required this.account,
  });

  final LooApiClient apiClient;
  final MobilePortfolioCashAccount account;

  @override
  State<_CashAccountBalanceSheet> createState() =>
      _CashAccountBalanceSheetState();
}

class _CashAccountBalanceSheetState extends State<_CashAccountBalanceSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _balanceController;
  var _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _balanceController = TextEditingController(
      text: widget.account.currentBalanceAmount.toStringAsFixed(2),
    );
  }

  @override
  void dispose() {
    _balanceController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.apiClient.updateManualCashAccountBalance(
        cashAccountId: widget.account.id,
        currentBalanceAmount:
            double.tryParse(_balanceController.text.trim()) ?? 0,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("更新现金余额", style: Theme.of(context).textTheme.titleLarge),
            SizedBox(height: tokens.gapSm),
            Text(
              "${widget.account.name} · ${widget.account.currency}",
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: tokens.mutedText,
                  ),
            ),
            SizedBox(height: tokens.gapSm),
            const Text("这里只记录现金账户当前余额，不会改变 TFSA/RRSP/FHSA room。"),
            SizedBox(height: tokens.gapLg),
            TextFormField(
              controller: _balanceController,
              enabled: !_submitting,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: "当前余额 ${widget.account.currency}",
                border: const OutlineInputBorder(),
              ),
              validator: _validateMoney,
            ),
            if (_error != null) ...[
              SizedBox(height: tokens.gapMd),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            SizedBox(height: tokens.gapLg),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed:
                        _submitting ? null : () => Navigator.of(context).pop(),
                    child: const Text("取消"),
                  ),
                ),
                SizedBox(width: tokens.gapSm),
                Expanded(
                  child: FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: Text(_submitting ? "保存中..." : "保存余额"),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String? _validateMoney(String? value) {
    final parsed = double.tryParse((value ?? "").trim());
    if (parsed == null || parsed < 0) {
      return "请输入大于等于 0 的数字";
    }
    return null;
  }
}
