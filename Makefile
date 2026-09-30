# =========================================================================
# Universal Makefile — cloudpulse-multi-tenant-analytics
# Author: Felipe Madison (@FelipeMadson)
# =========================================================================

.PHONY: all test bench lint build up down clean help

all: test lint

help:
	@echo "Comandos disponíveis:"
	@echo "  make test      - Executa suíte completa de testes automatizados"
	@echo "  make bench     - Executa micro-benchmarks de throughput e p99"
	@echo "  make lint      - Executa análise estática de tipos e código"
	@echo "  make build     - Compila pacotes e artefatos de distribuição"
	@echo "  make up        - Sobe ambiente local via Docker Compose"
	@echo "  make down      - Encerra contêineres e limpa volumes"
	@echo "  make clean     - Remove caches e diretórios temporários"

test:
	node --experimental-strip-types --test tests/**/*.test.ts

bench:
	node --experimental-strip-types benchmark/micro-bench.ts

lint:
	npx tsc --noEmit

build:
	npm run build

up:
	docker-compose up -d

down:
	docker-compose down

clean:
	rm -rf dist coverage .turbo
