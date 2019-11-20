make :
	wasm-pack build src/rust/ --out-dir ../../pkg
	yarn
	sudo npm install -g typescript
	npm install
	tsc -b tsconfig.json
	npm run build
compile :
	wasm-pack build src/rust/ --out-dir ../../pkg
	tsc -b tsconfig.json
	npm run build
install :
	sudo npm install -g typescript
	npm install
rust :
	wasm-pack build src/rust/ --out-dir ../../pkg
ts :
	tsc -b tsconfig.json
	npm run build