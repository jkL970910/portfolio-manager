import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../../core/auth/mobile_auth_session.dart";

class LoginPage extends StatefulWidget {
  const LoginPage({
    required this.onAuthenticated,
    super.key,
  });

  final ValueChanged<MobileAuthSession> onAuthenticated;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _apiClient = LooApiClient();

  var _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
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
      final response = await _apiClient.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      final session = MobileAuthSession.fromApiResponse(response);
      widget.onAuthenticated(session);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text("进入 Loo国", style: Theme.of(context).textTheme.headlineMedium),
                        const SizedBox(height: 8),
                        Text("登录后查看国库总览、组合御览和 Loo皇建议。", style: Theme.of(context).textTheme.bodyLarge),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          decoration: const InputDecoration(labelText: "邮箱"),
                          validator: (value) {
                            final text = value?.trim() ?? "";
                            if (!text.contains("@")) {
                              return "请输入有效邮箱。";
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          autofillHints: const [AutofillHints.password],
                          decoration: const InputDecoration(labelText: "密码"),
                          onFieldSubmitted: (_) => _submitting ? null : _submit(),
                          validator: (value) {
                            if ((value ?? "").length < 8) {
                              return "密码至少需要 8 位。";
                            }
                            return null;
                          },
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 16),
                          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                        ],
                        const SizedBox(height: 22),
                        FilledButton(
                          onPressed: _submitting ? null : _submit,
                          child: _submitting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text("召唤 Loo皇"),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
