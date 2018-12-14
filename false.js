// FALSE interpreter in JavaScript (Node.js). Taken and modified from http://www.quirkster.com/iano/js/false.js

var code = "";
var ahead = [];		// cache for scanning blocks,strings,comments
var ip = 0;
var stack = [];		// stack.push(n); n=stack.pop();
var ret = [];		// ret.push(ip); ip = ret.pop();
var vars = {};		// contains 'a'..'z'
var ini = 0;		// index into input
var doDump = false;	// whether to dump state
var doStep = false;	// whether to dump state every tick
var input = "";

Array.prototype.pick = function(n) { return this[this.length-n-1] }

function dump() {
	if (!doDump) return;
	var s = "";
	for (var p in vars)
		s += p + '=' + vars[p] + ' ';
	console.error("Variables:", s);
	console.error("Stack:", stack.join());
	s = [];
	for (var i=0; i<ret.length; ++i) {
		if (ret[i]>=0 && ret[i]<code.length)
			s.push(ret[i] + code.charAt(ret[i]));
		else
			s.push(ret[i]);
	}
	console.error("Return stack:", s.join());
	console.error("Code:", ip >= code.length ? code : code.slice(0, ip) + '{' + code[ip] + '}' + code.slice(ip+1));
}

function seek(c) {
	if (!ahead[ip])
		ahead[ip] = ip + code.slice(ip).indexOf(c);
	return ahead[ip];
}
var braces = {
	"{":function() { return seek("}") },
	'"':function() { ++ip; return seek('"') },
	"'":function() { return ip+1 },
	"[":matching_brace
}

function matching_brace() {
	var start = ip;
	if (!ahead[start]) {
		while (ip < code.length) {
			var c = code.charAt(++ip);
			if (c == ']')
				break;
			if (braces[c])
				ip = braces[c]();
		}
		ahead[start] = ip;
	}
	return ahead[start];
}

function put(s) {
	process.stdout.write(s.toString());
}

function getc() {
	return ini < input.length ? input.charCodeAt(ini++) : -1;
}

var commands = {
	"%":function() { stack.pop() },
	"$":function() { stack.push(stack.pick(0)) },
	"\\":function() { var t=stack.length-2; stack.splice(t,2,stack[t+1],stack[t]) },
	"@":function() { var t=stack.length-3; stack.splice(t,3,stack[t+1],stack[t+2],stack[t]) },
	"\xF8":function() { stack.push(stack.pick(stack.pop())) },  // "ø" pick
//	"(":function() { ret.push(stack.pop()) },
//	")":function() { stack.push(ret.pop()) },
	
	"+":function() { stack.push(stack.pop()+stack.pop()) },
	"-":function() { stack.push(-stack.pop()+stack.pop()) },
	"*":function() { stack.push(stack.pop()*stack.pop()) },
	"/":function() {		// div
		var d = stack.pop(), n = stack.pop(), r = n/d;
		stack.push(r<0?Math.ceil(r):Math.floor(r));
	},
	"_":function() { stack.push(-stack.pop()) },
	
	"&":function() { stack.push(stack.pop()&stack.pop()) },
	"|":function() { stack.push(stack.pop()|stack.pop()) },
	"~":function() { stack.push(~stack.pop()) },
//	"<":function() { stack.push(-(stack.pop()>stack.pop())) },
	"=":function() { stack.push(-(stack.pop()==stack.pop())) },
	">":function() { stack.push(-(stack.pop()<stack.pop())) },
	
	"{":function() { ip = seek("}") },
	"'":function() { stack.push(code.charCodeAt(++ip)) },
	'"':function() {
		var start = ++ip;
		ip = seek('"');
		put(code.substring(start,ip));
	},
	".":function() { put(stack.pop()) },
	",":function() { put(String.fromCharCode(stack.pop())) },
	"^":function() { stack.push(getc()) },
	"\xDF":function() {},  // "ß" flush (noop)
	
	":":function() { vars[stack.pop()] = stack.pop() },
	";":function() { stack.push( vars[stack.pop()] ) },
	
	"[":function() { stack.push(ip); ip = matching_brace(); },
	"]":function() {
		var n = ret.length-3;
		if (n>=0 && code.charAt(ret[n]) == '#') {
			if (stack.pop()) {
				ret.push(ret[n+1], ret[n+2]);	// continue loop
			} else {
				ret.pop(); ret.pop();		// exit loop
			}
		};
		ip = ret.pop();
	},
	"!":function() { ret.push(ip); ip = stack.pop(); },
	"?":function() {		// cond[true]?
		var t = stack.pop();
		if (stack.pop()) { ret.push(ip); ip = t; }
	},
	"#":function() {
		ret.push(ip, stack.pick(1), stack.pop());  // ip, test, body
		// ip points to #, signals that we're doing a loop
		ip = stack.pop();        // execute test first
	},
	
	"`":function() { stack.pop() }	// compile short (asm)  (unsupported)
}

function eval() {
	var c = code[ip];
	if (/\d/.test(c)) {
		var sn = code.substring(ip);
		var num = sn.match(/\d+/)[0];
		stack.push(parseInt(num,10));
		ip += num.length;
		return;
	} else
	if (/[a-z]/.test(c)) {
		stack.push(c);
	} else
	if (commands[c])
		commands[c]();
	else
	if (/\s/.test(c)) {
		var sn = code.substring(ip);
		var sp = sn.match(/\s+/)[0];
		ip += sp.length;
		return;
	} else
		console.error("Bad char '" + c + "': " + code.charCodeAt(ip));
	++ip;
}

function step() {
	while (ip < code.length) {
		eval();
		dump();
	}
}

function run() {
	while (ip < code.length)
		eval();
	dump();
}

function help() {
	console.log("\
node false.js [FILE] [ARGUMENTS]\n\
\n\
Arguments:\n\
-c	--code	[CODE]	Use code [CODE] instead of reading from a file\n\
-i	--input	[INPUT]	Use initial input [INPUT]\n\
-s	--stack [STACK]	Use initial stack [STACK] (delimited by commas)\n\
	--step		Dump state of stacks every tick\n\
-d	--dump		Dump state of stacks at end\n\
-h	--help		Show this help message");
	process.exit(0);
}

function readStdin() {
	return new Promise(function(resolve, reject) {
		process.stdin.on('data', function(chunk) {
			input += chunk;
		});

		process.stdin.on('end', function() {
			resolve();
		});
	});
}

function handleArgs() {
	if (process.argv.length <= 2) {
		help;
	}
	for (var i = 2; i < process.argv.length; i++) {
		var item = process.argv[i];
		if (item[0] == '-' && item[1] != '-' && item.length > 2) {
			for (var j = 2; j < item.length; j++) {
				process.argv.splice(i + 1, 0, '-' + item[j]);
			}
			item = item.slice(0, 2);
		}
		switch (item) {
			case '-c':
			case '--code':
				if (i == process.argv.length - 1) {
					console.error('Expected code after \'-c\'/\'--code\' flag');
					process.exit(1);
				}
				code += process.argv[++i];
				break;
			case '-i':
			case '--input':
				if (i == process.argv.length - 1) {
					console.error('Expected input after \'-i\'/\'--input\' flag');
					process.exit(1);
				}
				input += process.argv[++i];
				break;
			case '-s':
			case '--stack':
				if (i == process.argv.length - 1) {
					console.error('Expected stack after \'-s\'/\'--stack\' flag');
					process.exit(1);
				}
				stack = stack.concat(process.argv[++i].split(',').map(function(item) { return +item }));
				break;
			case '-d':
			case '--dump':
				doDump = true;
				break;
			case '--step':
				doDump = doStep = true;
				break;
			case '-h':
			case '--help':
				help();
				break;
			case '-f':
			case '--file':
				if (i == process.argv.length - 1) {
					console.error('Expected file path after \'-f\'/\'--file\' flag');
					process.exit(1);
				}
				item = process.argv[++i];
			default:
				code += require('fs').readFileSync(item).toString();
				break;
		}
	}
	if (doStep) {
		step();
	} else {
		run();
	}
}

readStdin().then(handleArgs);
