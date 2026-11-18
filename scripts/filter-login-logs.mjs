import readline from 'node:readline';
for await(const line of readline.createInterface({input:process.stdin})){
  const reason=line.match(/"(csrf-cookie-missing|csrf-mismatch|login-context|google-token|login-nonce|game-session|request-format|login-origin|login-config|login-size)"/);
  if(reason)process.stdout.write('Login check: '+reason[1]+'\n');
}
