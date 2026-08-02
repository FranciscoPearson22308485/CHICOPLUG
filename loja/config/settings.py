"""
Configuração do projecto CHICOPLUG.

Boutique multimarca de streetwear premium. Páginas renderizadas no servidor
(templates Django), estilo em Tailwind compilado e JavaScript sem framework.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Em produção as variáveis vêm da plataforma; o ficheiro só existe em dev.
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# ─── Núcleo ───────────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "dev-inseguro-troca-isto-em-producao")
DEBUG = env_bool("DEBUG", True)

ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "*").split(",") if h.strip()]

# Falhar aqui é preferível a servir a loja com a chave de desenvolvimento.
if not DEBUG and SECRET_KEY.startswith("dev-"):
    raise RuntimeError(
        "SECRET_KEY de desenvolvimento activa com DEBUG=False. "
        'Gera uma nova com: python -c "import secrets;print(secrets.token_urlsafe(50))"'
    )

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "django.contrib.sitemaps",
    # `django.contrib.admin` fica deliberadamente de fora: o painel de
    # administração é desenhado à medida (app `painel`), e expor o admin
    # genérico do Django ao lado dele criaria duas portas para o mesmo sítio.
    "contas",
    "catalogo",
    "encomendas",
    "painel",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "encomendas.middleware.CarrinhoMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                # Dados presentes em todas as páginas: navegação e carrinho.
                "catalogo.context_processors.navegacao",
                "encomendas.context_processors.carrinho",
            ],
            "builtins": ["catalogo.templatetags.loja"],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ─── Base de dados ────────────────────────────────────────────────────────────

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "chicoplug_py"),
        "USER": os.getenv("DB_USER", "chicoplug"),
        "PASSWORD": os.getenv("DB_PASSWORD", "chicoplug"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5433"),
        # Reaproveita ligações entre pedidos em vez de abrir uma nova a cada um.
        "CONN_MAX_AGE": env_int("DB_CONN_MAX_AGE", 60),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── Autenticação ─────────────────────────────────────────────────────────────

# O email identifica o cliente; não faz sentido pedir um "nome de utilizador"
# separado numa loja.
AUTH_USER_MODEL = "contas.Utilizador"

AUTHENTICATION_BACKENDS = ["contas.backends.EmailBackend"]

LOGIN_URL = "contas:entrar"
LOGIN_REDIRECT_URL = "contas:perfil"
LOGOUT_REDIRECT_URL = "catalogo:home"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── Internacionalização ──────────────────────────────────────────────────────

LANGUAGE_CODE = "pt"
TIME_ZONE = "Africa/Luanda"
USE_I18N = True
USE_TZ = True

# ─── Ficheiros estáticos e media ──────────────────────────────────────────────

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Acrescenta hash ao nome e comprime: permite cache longa sem servir
    # ficheiros velhos depois de um deploy.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# ─── Segurança ────────────────────────────────────────────────────────────────

CSRF_COOKIE_HTTPONLY = False  # O JavaScript do carrinho precisa de ler o token.
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30

CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ─── Email ────────────────────────────────────────────────────────────────────

# PENDENTE DE CONFIGURAÇÃO: sem SMTP definido, os emails (recuperação de
# password, confirmações) são escritos na consola em vez de enviados.
if os.getenv("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.getenv("EMAIL_HOST")
    EMAIL_PORT = env_int("EMAIL_PORT", 587)
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "CHICOPLUG <ola@chicoplug.ao>")

# ─── Loja ─────────────────────────────────────────────────────────────────────

SITE_URL = os.getenv("SITE_URL", "http://localhost:8000")
SITE_NAME = "CHICOPLUG"

# Valores em Kwanzas inteiros: o formato de apresentação não usa decimais, e
# guardar cêntimos só criaria divergência entre a soma das linhas e o total.
CUSTO_ENVIO = env_int("CUSTO_ENVIO", 3500)
ENVIO_GRATIS_A_PARTIR_DE = env_int("ENVIO_GRATIS_A_PARTIR_DE", 100000)

# ─── Pagamentos (Multicaixa Express) ──────────────────────────────────────────

PAGAMENTOS_PROVEDOR = os.getenv("PAGAMENTOS_PROVEDOR", "simulador")
MULTICAIXA_API_URL = os.getenv(
    "MULTICAIXA_API_URL", "https://pagamentonline.emis.co.ao/online-payment-gateway/portal"
)
MULTICAIXA_POS_ID = os.getenv("MULTICAIXA_POS_ID", "")
MULTICAIXA_CALLBACK_URL = os.getenv("MULTICAIXA_CALLBACK_URL", "")
MULTICAIXA_WEBHOOK_SECRET = os.getenv("MULTICAIXA_WEBHOOK_SECRET", "")
MULTICAIXA_CERT_PATH = os.getenv("MULTICAIXA_CERT_PATH", "")
MULTICAIXA_CERT_PASSPHRASE = os.getenv("MULTICAIXA_CERT_PASSPHRASE", "")

# ─── Cloudinary ───────────────────────────────────────────────────────────────

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
CLOUDINARY_ACTIVO = bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)

MESSAGE_STORAGE = "django.contrib.messages.storage.session.SessionStorage"

# Nos testes não corremos `collectstatic`, e o armazenamento com manifesto
# rebentaria em qualquer template que use {% static %}. Trocamos por um simples.
import sys  # noqa: E402

if "test" in sys.argv:
    STORAGES["staticfiles"]["BACKEND"] = "django.contrib.staticfiles.storage.StaticFilesStorage"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO" if DEBUG else "WARNING"},
}
