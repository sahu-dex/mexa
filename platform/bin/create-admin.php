<?php
declare(strict_types=1);
// Run locally or via cPanel terminal; password is read without echo on Unix.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$configPath = __DIR__.'/../app/config.php';
if (!is_file($configPath)) exit("Configure app/config.php first.\n");
$c=require $configPath;
$db=new PDO('mysql:host='.$c['db_host'].';dbname='.$c['db_name'].';charset=utf8mb4',$c['db_user'],$c['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
echo "Name: "; $name=trim((string)fgets(STDIN)); echo "Email: "; $email=strtolower(trim((string)fgets(STDIN)));
if (!filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($email)>190 || $name==='' || strlen($name)>100) exit("Invalid details.\n");
echo "Password (minimum 12 characters): ";
if (DIRECTORY_SEPARATOR === '/') shell_exec('stty -echo');
$password=rtrim((string)fgets(STDIN),"\r\n");
if (DIRECTORY_SEPARATOR === '/') shell_exec('stty echo');
echo "\n";
if (strlen($password)<12 || strlen($password)>72) exit("Invalid password length.\n");
$q=$db->prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,\'admin\')');
try { $q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT)]); echo "Administrator created.\n"; } catch (PDOException $e) { fwrite(STDERR,"Could not create administrator. Check that the email is unique.\n"); exit(1); }
