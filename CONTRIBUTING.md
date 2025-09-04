# Contributing Guide

## ブランチ運用
- main: 常にデプロイ可能（直接 push しない）
- feature/*: 機能追加（例: feature/quick-complete-today）
- fix/*: 不具合修正（例: fix/addtask-allow-today）

## PR ルール
- タイトル: feat/fix/chore: 要約
- 説明: 目的 / 変更点 / 確認手順
- マージ条件: CI（lint/build）成功、レビュー1件以上

## チェックリスト（PR前）
- [ ] npm run lint
- [ ] npm run build
- [ ] 主要フローの手動確認

## 手順
1. git checkout -b feature/<topic>
2. 実装して動作確認
3. npm run lint && npm run build
4. PR 作成 → レビュー → main へマージ
