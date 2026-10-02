<div class="max-w-md mx-auto mt-16 text-center">
  <h1 class="text-xl font-semibold mb-2"><?= h($title ?? 'エラー') ?></h1>
  <p class="text-sm text-gray-600"><?= h($message ?? '') ?></p>
  <p class="mt-6"><a class="text-line-dark hover:underline" href="<?= url('/dashboard') ?>">アカウント一覧へ戻る</a></p>
</div>
