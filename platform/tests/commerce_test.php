<?php
declare(strict_types=1);
require __DIR__.'/../app/commerce.php';
$cases = [ ['1',100], ['1.2',120], ['0.01',1], ['9999999.99',999999999], ['-1',0], ['1e3',0], ['1.999',0], ['00.50',0], ['10000000',0], ['',0] ];
foreach ($cases as [$input,$expected]) {
    $actual=amount_poisha($input);
    if ($actual!==$expected) { fwrite(STDERR, "FAIL: amount $input: $actual != $expected\n"); exit(1); }
}
$_SESSION=[]; $key=form_key();
if (strlen($key)!==64 || !isset($_SESSION['form_keys'][$key])) { fwrite(STDERR,"FAIL: form key\n"); exit(1); }
if (form_key()===$key) { fwrite(STDERR,"FAIL: duplicate form key\n"); exit(1); }
echo "PASS: amount parsing and form key generation\n";
