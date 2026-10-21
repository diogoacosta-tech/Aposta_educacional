<?php
declare(strict_types=1);

/**
 * Porta de entrada PHP da liquidação.
 * Valida o pedido e entrega o cálculo ao motor Java.
 * Não sorteia prêmio nem altera saldo por conta própria.
 */

ini_set('display_errors', '0');

function respond(array $payload, int $code = 0): void
{
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($code !== 0) {
        exit($code);
    }
}

function fail(string $code, string $error): void
{
    respond(['ok' => false, 'code' => $code, 'error' => $error], 0);
    exit(0);
}

function whole_number(mixed $value): bool
{
    if (is_int($value)) {
        return true;
    }
    if (is_float($value)) {
        return $value >= 0 && floor($value) === $value && $value <= 9007199254740991;
    }
    return false;
}

$raw = stream_get_contents(STDIN);
if ($raw === false || trim($raw) === '') {
    fail('validation', 'Pedido vazio.');
}

try {
    $data = json_decode($raw, false, 8, JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    fail('validation', 'JSON inválido.');
}

if (!is_object($data) || !isset($data->players) || !is_array($data->players)) {
    fail('validation', 'Informe a lista de jogadores.');
}

$count = count($data->players);
if ($count < 1 || $count > 5) {
    fail('validation', 'A disputa aceita de 1 a 5 jogadores.');
}

$modes = ['subir' => true, 'cair' => true, 'automatico' => true];
$directions = ['up' => true, 'down' => true, 'flat' => true];
$seen = [];
$lines = [(string) $count];

foreach ($data->players as $player) {
    if (!is_object($player)) {
        fail('validation', 'Jogador inválido.');
    }
    $id = isset($player->id) ? (string) $player->id : '';
    if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/', $id)) {
        fail('validation', 'Identificador de jogador inválido.');
    }
    if (isset($seen[$id])) {
        fail('validation', 'Jogador repetido na rodada.');
    }
    $seen[$id] = true;

    if (!isset($player->balance) || !whole_number($player->balance)) {
        fail('validation', 'Saldo inválido.');
    }
    if (!isset($player->stake) || !whole_number($player->stake)) {
        fail('validation', 'A aposta precisa ser um inteiro positivo.');
    }
    $balance = (int) $player->balance;
    $stake = (int) $player->stake;
    if ($balance < 0) {
        fail('validation', 'Saldo negativo não é permitido.');
    }
    if ($stake < 1) {
        fail('validation', 'A aposta mínima é 1 bala.');
    }
    if ($stake > $balance) {
        fail('validation', 'A aposta não pode passar do saldo disponível.');
    }

    $mode = isset($player->mode) ? (string) $player->mode : '';
    $direction = isset($player->direction) ? (string) $player->direction : '';
    if (!isset($modes[$mode])) {
        fail('validation', 'Modo de aposta inválido.');
    }
    if (!isset($directions[$direction])) {
        fail('validation', 'Direção do último segmento inválida.');
    }

    $prizeRoll = -1;
    $lollipopRoll = -1;
    if (isset($player->prizeRoll)) {
        if (!whole_number($player->prizeRoll)) {
            fail('validation', 'Rolagem de prêmio inválida.');
        }
        $prizeRoll = (int) $player->prizeRoll;
        if ($prizeRoll < 0 || $prizeRoll > 94) {
            fail('validation', 'Rolagem de prêmio fora da tabela.');
        }
    }
    if (isset($player->lollipopRoll)) {
        if (!whole_number($player->lollipopRoll)) {
            fail('validation', 'Rolagem de pirulito inválida.');
        }
        $lollipopRoll = (int) $player->lollipopRoll;
        if ($lollipopRoll < 0 || $lollipopRoll > 99) {
            fail('validation', 'Rolagem de pirulito inválida.');
        }
    }

    $lines[] = $id . ' ' . $balance . ' ' . $stake . ' ' . $mode . ' ' . $direction . ' ' . $prizeRoll . ' ' . $lollipopRoll;
}

$root = dirname(__DIR__);
$java = getenv('BALABET_JAVA') ?: 'java';
$cp = getenv('BALABET_CP') ?: ($root . '/java/build');
$command = [$java, '-cp', $cp, 'com.balabet.Main'];

$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];

$process = proc_open($command, $descriptors, $pipes);
if (!is_resource($process)) {
    fail('engine_unavailable', 'Não foi possível iniciar o motor Java.');
}

fwrite($pipes[0], implode("\n", $lines) . "\n");
fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$exit = proc_close($process);

if (!is_string($stdout) || trim($stdout) === '') {
    fail('engine_unavailable', 'O motor Java não respondeu.');
}

$rows = preg_split("/\r\n|\n|\r/", trim($stdout));
if ($rows === false || !isset($rows[0])) {
    fail('engine_unavailable', 'Resposta vazia do motor Java.');
}

if (str_starts_with($rows[0], 'ERR')) {
    $message = trim(substr($rows[0], 3));
    fail('validation', $message !== '' ? $message : 'A liquidação foi recusada.');
}

if ($rows[0] !== 'OK' || $exit !== 0) {
    fail('engine_unavailable', 'Falha ao liquidar a rodada.');
}

$results = [];
for ($i = 1; $i < count($rows); $i++) {
    if ($rows[$i] === '') {
        continue;
    }
    $parts = explode(' ', $rows[$i]);
    if (count($parts) !== 9) {
        fail('engine_unavailable', 'Resposta incompleta do motor Java.');
    }
    $results[] = [
        'id' => $parts[0],
        'outcome' => $parts[1],
        'prize' => (int) $parts[2],
        'lollipop' => $parts[3] === '1',
        'balanceAfter' => (int) $parts[4],
        'displayedDelta' => (int) $parts[5],
        'stake' => (int) $parts[6],
        'prizeRoll' => (int) $parts[7],
        'lollipopRoll' => (int) $parts[8],
    ];
}

if (count($results) !== $count) {
    fail('engine_unavailable', 'A quantidade de resultados não confere.');
}

respond([
    'ok' => true,
    'engine' => 'java',
    'via' => 'php',
    'results' => $results,
]);
