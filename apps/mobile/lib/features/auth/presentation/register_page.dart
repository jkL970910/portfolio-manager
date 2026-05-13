import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../../core/auth/mobile_auth_session.dart";
import "../../../core/theme/loo_theme.dart";

class RegisterPage extends StatefulWidget {
  const RegisterPage({
    required this.onAuthenticated,
    required this.onBackToLogin,
    super.key,
  });

  final ValueChanged<MobileAuthSession> onAuthenticated;
  final VoidCallback onBackToLogin;

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _birthDateController = TextEditingController();
  final _apiClient = LooApiClient();

  var _gender = "female";
  var _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _birthDateController.dispose();
    super.dispose();
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(1920),
      lastDate: now,
    );
    if (picked == null) return;
    _birthDateController.text =
        "${picked.year.toString().padLeft(4, "0")}-${picked.month.toString().padLeft(2, "0")}-${picked.day.toString().padLeft(2, "0")}";
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final response = await _apiClient.register(
        displayName: _nameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
        gender: _gender,
        birthDate: _birthDateController.text.trim(),
      );
      widget.onAuthenticated(MobileAuthSession.fromApiResponse(response));
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(18),
                              child: Image.asset(
                                _gender == "male"
                                    ? "assets/images/mascot/loo_male.jpg"
                                    : "assets/images/mascot/loo_female.jpg",
                                width: 62,
                                height: 62,
                                fit: BoxFit.cover,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "创建 Loo国身份",
                                    style:
                                        Theme.of(context).textTheme.titleLarge,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    "注册后自动进入宝库。",
                                    style:
                                        Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _nameController,
                          decoration: const InputDecoration(labelText: "公民姓名"),
                          autofillHints: const [AutofillHints.name],
                          validator: (value) {
                            if ((value ?? "").trim().length < 2) {
                              return "姓名至少需要 2 个字符。";
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(value: "female", label: Text("女公民")),
                            ButtonSegment(value: "male", label: Text("男公民")),
                          ],
                          selected: {_gender},
                          onSelectionChanged: _submitting
                              ? null
                              : (value) =>
                                  setState(() => _gender = value.first),
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _birthDateController,
                          readOnly: true,
                          decoration: const InputDecoration(
                            labelText: "生日",
                            suffixIcon: Icon(Icons.calendar_month_rounded),
                          ),
                          onTap: _submitting ? null : _pickBirthDate,
                          validator: (value) {
                            final text = value?.trim() ?? "";
                            if (!RegExp(r"^\d{4}-\d{2}-\d{2}$")
                                .hasMatch(text)) {
                              return "请选择生日。";
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          decoration: const InputDecoration(labelText: "邮箱"),
                          validator: (value) {
                            if (!(value?.trim() ?? "").contains("@")) {
                              return "请输入有效邮箱。";
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          autofillHints: const [AutofillHints.newPassword],
                          decoration: const InputDecoration(labelText: "密码"),
                          onFieldSubmitted: (_) =>
                              _submitting ? null : _submit(),
                          validator: (value) {
                            if ((value ?? "").length < 8) {
                              return "密码至少需要 8 位。";
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: tokens.accentSoft,
                            borderRadius:
                                BorderRadius.circular(tokens.radiusMd),
                            border: Border.all(color: tokens.cardBorder),
                          ),
                          child: Text(
                            "注册即确认接受 Loo国条例，并创建默认投资偏好档案。后续可在设置中修改偏好。",
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 16),
                          Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ],
                        const SizedBox(height: 22),
                        FilledButton(
                          onPressed: _submitting ? null : _submit,
                          child: _submitting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text("创建并进入 Loo国"),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed:
                              _submitting ? null : widget.onBackToLogin,
                          child: const Text("已有身份，返回登录"),
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
