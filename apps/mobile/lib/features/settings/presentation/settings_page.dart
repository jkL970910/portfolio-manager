import "package:flutter/material.dart";

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("设置"),
          SizedBox(height: 12),
          Text("这里将承接偏好设置、观察列表、公民档案和推荐参数配置。"),
        ],
      ),
    );
  }
}
