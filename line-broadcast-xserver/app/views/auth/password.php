<div class="max-w-md">
  <h1 class="text-xl font-semibold mb-4">パスワード変更</h1>
  <form method="post" action="<?= url('/account/password') ?>" class="bg-white border rounded p-5 space-y-4">
    <?= csrf_field() ?>
    <div><label class="block text-sm font-medium">現在のパスワード</label><input type="password" name="current" required class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
    <div><label class="block text-sm font-medium">新しいパスワード（8文字以上）</label><input type="password" name="new" required minlength="8" class="mt-1 w-full border rounded px-3 py-2 text-sm"></div>
    <button class="bg-line text-white rounded px-4 py-2 text-sm">変更する</button>
  </form>
</div>
