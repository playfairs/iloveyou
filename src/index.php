<?php
declare(strict_types=1);

$title = 'I Love You';
$scriptName = 'heart';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <canvas id="heartCanvas"></canvas>
  <script src="main.js"></script>
</body>
</html>
