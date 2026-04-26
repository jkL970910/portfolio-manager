import "package:flutter/material.dart";

class SettingsPage extends StatelessWidget {
  const SettingsPage({
    required this.viewerName,
    required this.onLogout,
    super.key,
  });

  final String viewerName;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("设置", style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 12),
          Text("当前居民：$viewerName"),
          const SizedBox(height: 12),
          const Text("这里将承接偏好设置、观察列表、公民档案和推荐参数配置。"),
          const Spacer(),
          FilledButton.tonalIcon(
            onPressed: onLogout,
            icon: const Icon(Icons.logout),
            label: const Text("退出 Loo国"),
          ),
        ],
      ),
    );
  }
}
