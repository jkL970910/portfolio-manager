import "package:flutter/material.dart";

class ImportPage extends StatelessWidget {
  const ImportPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("导入"),
          SizedBox(height: 12),
          Text("这里将承接导入入口、工作流选择、后续的映射与校验步骤。"),
        ],
      ),
    );
  }
}
