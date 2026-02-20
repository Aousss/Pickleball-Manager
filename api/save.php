<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Get raw POST data
$input = file_get_contents('php://input');

if ($input) {
    // Basic validation to ensure it's JSON
    $decoded = json_decode($input);
    if ($decoded === null) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
        exit;
    }

    // Save to file
    if (file_put_contents('data.json', $input)) {
        echo json_encode(['status' => 'success']);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Failed to write file']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No data received']);
}
?>
