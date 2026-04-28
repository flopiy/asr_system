<!DOCTYPE html><html lang="uk"><head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Оформлення репозиторію ASR-системи: комплексний посібник</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&amp;family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        'serif': ['Playfair Display', 'serif'],
                        'sans': ['Inter', 'sans-serif'],
                    },
                    colors: {
                        'primary': '#1e293b',
                        'secondary': '#64748b',
                        'accent': '#0f172a',
                        'muted': '#f8fafc',
                        'border': '#e2e8f0',
                    }
                }
            }
        }
    </script>
    <style>
        .gradient-overlay {
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%);
        }
        .hero-text {
            text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        .toc-fixed {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 280px;
            background: #ffffff;
            border-right: 1px solid #e2e8f0;
            z-index: 40;
            overflow-y: auto;
            padding: 2rem 1.5rem;
        }
        .main-content {
            margin-left: 280px;
            min-height: 100vh;
        }
        .toc-link {
            transition: all 0.2s ease;
        }
        .toc-link:hover {
            color: #1e293b;
            background-color: #f8fafc;
        }
        .toc-link.active {
            color: #1e293b;
            background-color: #e2e8f0;
            border-left: 3px solid #1e293b;
        }
        .code-block {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem;
            overflow-x: auto;
        }
        @media (max-width: 1024px) {
            .toc-fixed {
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            }
            .toc-fixed.mobile-open {
                transform: translateX(0);
            }
            .main-content {
                margin-left: 0;
            }
        }
    </style>
  <base target="_blank">
</head>

  <body class="bg-white text-primary font-sans leading-relaxed">
    <!-- Mobile TOC Toggle -->
    <button id="toc-toggle" class="lg:hidden fixed top-4 left-4 z-50 bg-primary text-white p-3 rounded-lg shadow-lg">
      <i class="fas fa-bars"></i>
    </button>

    <!-- Table of Contents -->
    <nav class="toc-fixed" id="toc">
      <div class="mb-8">
        <h2 class="font-serif text-xl font-bold text-primary mb-4">Зміст</h2>
        <div class="space-y-1">
          <a href="#introduction" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">Вступ</a>
          <a href="#repository-structure" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">1. Структура репозиторію</a>
          <a href="#modular-code-structure" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">2. Модульна структура коду</a>
          <a href="#code-standardization" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">3. Стандартизація коду</a>
          <a href="#readme-structure" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">4. Структура README</a>
          <a href="#virtual-environment" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">5. Віртуальне середовище</a>
          <a href="#configuration-files" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">6. Конфігураційні файли</a>
          <a href="#testing-ci" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">7. Тестування та CI/CD</a>
          <a href="#repository-examples" class="toc-link block px-3 py-2 text-sm text-secondary rounded-md">8. Приклади репозиторіїв</a>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Hero Section -->
      <section class="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div class="absolute inset-0">
          <img src="https://kimi-web-img.moonshot.cn/img/static.vecteezy.com/165d2f91fd42bf1f8fa476b1d8520a1f92de565d.jpg" alt="Абстрактний синій фон, що нагадує звукову хвилю" class="w-full h-full object-cover opacity-20" size="wallpaper" aspect="wide" color="blue" query="sound wave abstract blue background" referrerpolicy="no-referrer" data-modified="1" data-score="0.00"/>
          <div class="absolute inset-0 gradient-overlay"></div>
        </div>

        <div class="relative z-10 max-w-6xl mx-auto px-4 md:px-8 text-center text-white">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div class="md:col-span-8">
              <h1 class="font-serif text-4xl md:text-5xl lg:text-7xl font-bold mb-6 hero-text italic">
                Оформлення репозиторію ASR-системи
              </h1>
              <p class="text-lg md:text-xl lg:text-2xl font-light mb-8 hero-text opacity-90">
                Комплексний посібник з організації коду, документування та розгортання систем автоматичного розпізнавання мови
              </p>
            </div>
            <div class="md:col-span-4">
              <div class="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6 border border-white/20">
                <h3 class="font-serif text-lg md:text-xl font-semibold mb-3">Ключові показники</h3>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span>Покращення WER</span>
                    <span class="font-bold">47%</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Підтримувані мови</span>
                    <span class="font-bold">99+</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Модельних архітектур</span>
                    <span class="font-bold">5+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Introduction -->
      <section id="introduction" class="py-16 bg-muted">
        <div class="max-w-4xl mx-auto px-8">
          <div class="prose prose-lg max-w-none">
            <p class="text-xl leading-relaxed text-secondary mb-8">
              Для оформлення репозиторію <code class="bg-white px-2 py-1 rounded text-sm">flopiy/asr_system</code> створіть структуру з директоріями <code>src/</code>, <code>scripts/</code>, <code>configs/</code>, <code>notebooks/</code>, <code>tests/</code>, <code>docs/</code>; додайте <code>pyproject.toml</code>, <code>requirements.txt</code>, ліцензію MIT/Apache-2.0, README з прикладами використання; налаштуйте <code>venv</code> або Conda з Docker для ізоляції; використовуйте <code>black</code>, <code>ruff</code>, <code>mypy</code> для контролю якості коду.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
              <div class="bg-white p-6 rounded-lg shadow-sm border">
                <i class="fas fa-code text-2xl text-primary mb-4"></i>
                <h3 class="font-serif text-lg font-semibold mb-2">Модульна архітектура</h3>
                <p class="text-secondary text-sm">Чітке розділення відповідальності між компонентами для легкої підтримки та розширення</p>
              </div>
              <div class="bg-white p-6 rounded-lg shadow-sm border">
                <i class="fas fa-book text-2xl text-primary mb-4"></i>
                <h3 class="font-serif text-lg font-semibold mb-2">Документація</h3>
                <p class="text-secondary text-sm">Комплексна документація з прикладами використання та API референсом</p>
              </div>
              <div class="bg-white p-6 rounded-lg shadow-sm border">
                <i class="fas fa-shield-alt text-2xl text-primary mb-4"></i>
                <h3 class="font-serif text-lg font-semibold mb-2">Якість коду</h3>
                <p class="text-secondary text-sm">Автоматизовані перевірки через pre-commit, статична типізація та тести</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Repository Structure -->
      <section id="repository-structure" class="py-16">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">1. Коренева структура репозиторію</h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            <div>
              <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Базова організація директорій</h3>
              <div class="space-y-4">
                <div class="bg-muted p-4 rounded-lg">
                  <h4 class="font-semibold text-primary mb-2">src/ — основний пакет</h4>
                  <p class="text-secondary text-sm">Кореневий каталог для Python-пакету з основною функціональністю ASR системи. Містить підмодулі: models/, data/, training/, evaluation/, inference/, utils/</p>
                </div>
                <div class="bg-muted p-4 rounded-lg">
                  <h4 class="font-semibold text-primary mb-2">scripts/ — утилітні скрипти</h4>
                  <p class="text-secondary text-sm">Виконувані скрипти для запуску демонстрацій, пакетної обробки, тренування та оцінювання. Ізольовані від основного пакету для гнучкості</p>
                </div>
                <div class="bg-muted p-4 rounded-lg">
                  <h4 class="font-semibold text-primary mb-2">configs/ — конфігурації</h4>
                  <p class="text-secondary text-sm">Централізоване сховище YAML/JSON файлів з гіперпараметрами, налаштуваннями оптимізаторів та параметрами датасетів</p>
                </div>
              </div>
            </div>
            <div>
              <div class="bg-white border rounded-lg p-6 shadow-sm">
                <h4 class="font-semibold text-primary mb-4">Рекомендована структура</h4>
                <div class="code-block text-sm">
                  <pre><code>asr_system/
├── src/
│   ├── models/
│   ├── data/
│   ├── training/
│   ├── evaluation/
│   ├── inference/
│   └── utils/
├── scripts/
│   ├── train.py
│   ├── evaluate.py
│   ├── transcribe.py
│   └── demo.py
├── configs/
│   ├── training/
│   ├── inference/
│   └── data/
├── notebooks/
├── tests/
├── docs/
├── requirements.txt
├── pyproject.toml
└── Dockerfile</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white border rounded-lg p-8 shadow-sm">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Кореневі файли конфігурації</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 class="font-semibold text-primary mb-3">pyproject.toml</h4>
                <p class="text-secondary text-sm mb-3">Сучасний стандарт конфігурації Python-проектів (PEP 518/621). Замінює setup.py, setup.cfg та requirements.txt</p>
                <div class="code-block text-xs">
                  <pre><code>[project]
name = &#34;asr-system&#34;
version = &#34;0.1.0&#34;
dependencies = [
    &#34;torch&gt;=2.0.0&#34;,
    &#34;transformers&gt;=4.30.0&#34;,
    &#34;librosa&gt;=0.10.0&#34;,
]</code></pre>
                </div>
              </div>
              <div>
                <h4 class="font-semibold text-primary mb-3">requirements.txt</h4>
                <p class="text-secondary text-sm mb-3">Фіксовані версії залежностей для виробничого середовища з гарантованою відтворюваністю</p>
                <div class="code-block text-xs">
                  <pre><code>torch==2.1.0
transformers==4.35.0
librosa==0.10.1
numpy==1.24.3
soundfile==0.12.1</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Modular Code Structure -->
      <section id="modular-code-structure" class="py-16 bg-muted">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">2. Модульна структура коду в src/</h2>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            <div class="bg-white p-6 rounded-lg shadow-sm border">
              <div class="flex items-center mb-4">
                <i class="fas fa-brain text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">models/</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Реалізація акустичних моделей, завантаження попередньо натренованих ваг та адаптери для різних бекендів (Whisper, Wav2Vec2, Conformer)</p>
              <div class="code-block text-xs">
                <pre><code>class ASRModel:
    def transcribe(self, audio):
        pass
    
    def save(self, path):
        pass</code></pre>
              </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-sm border">
              <div class="flex items-center mb-4">
                <i class="fas fa-database text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">data/</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Завантаження аудіоданих, попередня обробка, аугментація та конвертери форматів датасетів</p>
              <div class="code-block text-xs">
                <pre><code>class AudioLoader:
    def load(self, path):
        pass
    
    def preprocess(self, audio):
        pass</code></pre>
              </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-sm border">
              <div class="flex items-center mb-4">
                <i class="fas fa-graduation-cap text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">training/</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Клас тренера з підтримкою різних стратегій, колбеки для моніторингу та утиліти для керування експериментами</p>
              <div class="code-block text-xs">
                <pre><code>class Trainer:
    def train(self, model, data):
        pass
    
    def evaluate(self):
        pass</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white border rounded-lg p-8 shadow-sm">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Принципи модульного проектування</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 class="font-semibold text-primary mb-3">Інверсія залежностей</h4>
                <p class="text-secondary text-sm mb-4">Абстрактні базові класи визначають інтерфейс, конкретні реалізації забезпечують функціональність. Це дозволяє легко замінювати компоненти без зміни коду, що їх використовує.</p>

                <h4 class="font-semibold text-primary mb-3">Адаптери для різних бекендів</h4>
                <p class="text-secondary text-sm">Єдиний інтерфейс над різними бібліотеками (Whisper, Wav2Vec2) приховує їх специфіку та забезпечує гнучкість системи.</p>
              </div>
              <div>
                <div class="code-block">
                  <pre><code>class ModelFactory:
    @staticmethod
    def create(model_type: str):
        if model_type == &#34;whisper&#34;:
            return WhisperAdapter()
        elif model_type == &#34;wav2vec2&#34;:
            return Wav2Vec2Adapter()
        else:
            raise ValueError(f&#34;Unknown model type: {model_type}&#34;)

# Використання
model = ModelFactory.create(&#34;whisper&#34;)
result = model.transcribe(audio_path)</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Code Standardization -->
      <section id="code-standardization" class="py-16">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">3. Стандартизація коду та документування</h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            <div>
              <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Google-style docstrings</h3>
              <p class="text-secondary mb-6">Документування коду є невід&#39;ємною частиною професійної розробки. Google-style docstrings є одним із найпопулярніших форматів завдяки своїй читабельності та підтримці інструментами.</p>

              <div class="bg-white border rounded-lg p-6">
                <h4 class="font-semibold text-primary mb-4">Структура docstring</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li><strong>Однорядковий опис:</strong> Коротке резюме функції</li>
                  <li><strong>Детальний опис:</strong> Розширена інформація (за необхідності)</li>
                  <li><strong>Args:</strong> Параметри функції з типами та описом</li>
                  <li><strong>Returns:</strong> Повернене значення з типом та описом</li>
                  <li><strong>Raises:</strong> Можливі винятки</li>
                  <li><strong>Examples:</strong> Приклади використання</li>
                </ul>
              </div>
            </div>

            <div>
              <div class="code-block">
                <pre><code>def transcribe_audio(
    audio_path: str,
    model_name: str = &#34;whisper-base&#34;,
    language: Optional[str] = None,
) -&gt; TranscriptionResult:
    &#34;&#34;&#34;Transcribe audio file to text.
    
    This function loads an audio file, preprocesses it,
    performs inference, and returns transcribed text.
    
    Args:
        audio_path: Path to the audio file.
        model_name: Name of the ASR model to use.
        language: Optional language code.
        
    Returns:
        TranscriptionResult object.
        
    Raises:
        FileNotFoundError: If audio_file does not exist.
        ValueError: If model_name is not supported.
        
    Examples:
        &gt;&gt;&gt; result = transcribe_audio(&#34;sample.wav&#34;)
        &gt;&gt;&gt; print(result.text)
        &#34;Hello world&#34;
    &#34;&#34;&#34;</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white border rounded-lg p-8 shadow-sm">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Інструменти контролю якості коду</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div class="text-center">
                <div class="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                  <span class="text-white font-bold text-lg">B</span>
                </div>
                <h4 class="font-semibold text-primary mb-2">black</h4>
                <p class="text-secondary text-sm">&#34;Непохитний&#34; форматувальник коду для єдиного стилю</p>
              </div>
              <div class="text-center">
                <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span class="text-white font-bold text-lg">R</span>
                </div>
                <h4 class="font-semibold text-primary mb-2">ruff</h4>
                <p class="text-secondary text-sm">Ультрашвидкий лінтер, що замінює десятки інструментів</p>
              </div>
              <div class="text-center">
                <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span class="text-white font-bold text-lg">M</span>
                </div>
                <h4 class="font-semibold text-primary mb-2">mypy</h4>
                <p class="text-secondary text-sm">Статична типізація для виявлення помилок до виконання</p>
              </div>
              <div class="text-center">
                <div class="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span class="text-white font-bold text-lg">P</span>
                </div>
                <h4 class="font-semibold text-primary mb-2">pre-commit</h4>
                <p class="text-secondary text-sm">Git hooks для автоматичних перевірок перед комітом</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- README Structure -->
      <section id="readme-structure" class="py-16 bg-muted">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">4. README.md: структура та зміст</h2>

          <div class="bg-white border rounded-lg p-8 shadow-sm mb-12">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Структура документації</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 class="font-semibold text-primary mb-4">Заголовкова секція</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Назва проекту з коротким описом</li>
                  <li>• Бейджі статусу збірки, ліцензії, версії</li>
                  <li>• Ключові досягнення та метрики продуктивності</li>
                </ul>

                <h4 class="font-semibold text-primary mb-4 mt-6">Опис проекту</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Постановка задачі та цільова аудиторія</li>
                  <li>• Архітектурний огляд системи</li>
                  <li>• Підтримувані моделі та мови</li>
                </ul>
              </div>
              <div>
                <h4 class="font-semibold text-primary mb-4">Швидкий старт</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Мінімальний приклад використання</li>
                  <li>• Запуск інтерактивної демонстрації</li>
                </ul>

                <h4 class="font-semibold text-primary mb-4 mt-6">Встановлення</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Системні вимоги та залежності</li>
                  <li>• Клонування репозиторію</li>
                  <li>• Налаштування віртуального середовища</li>
                  <li>• Верифікація встановлення</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <h4 class="font-semibold text-primary mb-4">Мінімальний приклад використання</h4>
              <div class="code-block text-sm">
                <pre><code># Встановлення
pip install asr-system

# Транскрипція файлу
asr-transcribe audio.wav \
    --model whisper-base \
    --language uk

# Використання в Python
from asr_system import Transcriber

transcriber = Transcriber.from_pretrained(
    &#34;whisper-base&#34;
)
result = transcriber.transcribe(&#34;audio.wav&#34;)
print(result.text)</code></pre>
              </div>
            </div>

            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <h4 class="font-semibold text-primary mb-4">Запуск демонстрації</h4>
              <div class="code-block text-sm">
                <pre><code># Запуск веб-інтерфейсу
pip install asr-system[demo]
asr-demo

# Або через скрипт
python scripts/demo.py

# Доступно за адресою
http://localhost:8504</code></pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Virtual Environment -->
      <section id="virtual-environment" class="py-16">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">5. Налаштування віртуального середовища</h2>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <div class="flex items-center mb-4">
                <i class="fas fa-cube text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">venv</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Стандартний модуль Python для створення ізольованих середовищ</p>
              <div class="code-block text-xs">
                <pre><code># Створення
python -m venv .venv

# Активація (Linux/macOS)
source .venv/bin/activate

# Активація (Windows)
.venv\Scripts\activate</code></pre>
              </div>
            </div>

            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <div class="flex items-center mb-4">
                <i class="fas fa-conda text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">Conda</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Потужне середовище для керування залежностями, особливо для CUDA</p>
              <div class="code-block text-xs">
                <pre><code># Створення
conda create -n asr python=3.10

# Активація
conda activate asr

# Встановлення PyTorch
conda install pytorch torchaudio \
    pytorch-cuda=11.8 -c pytorch \
    -c nvidia</code></pre>
              </div>
            </div>

            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <div class="flex items-center mb-4">
                <i class="fas fa-docker text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">Docker</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Повна ізоляція середовища виконання та вирішення проблеми &#34;працює на моїй машині&#34;</p>
              <div class="code-block text-xs">
                <pre><code># Побудова образу
docker build -t asr-system .

# Запуск з GPU
docker run --rm --gpus all \
    asr-system-gpu \
    scripts/train.py</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white border rounded-lg p-8 shadow-sm">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Сучасні інструменти керування залежностями</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h4 class="font-semibold text-primary mb-3">uv</h4>
                <p class="text-secondary text-sm mb-4">Ультрашвидкий менеджер пакетів, написаний на Rust. В 10-100 разів швидший за pip</p>
                <div class="code-block text-xs">
                  <pre><code># Встановлення
curl -LsSf https://astral.sh/uv/install.sh | sh

# Створення середовища
uv venv .venv

# Встановлення залежностей
uv pip install -r requirements.txt</code></pre>
                </div>
              </div>

              <div>
                <h4 class="font-semibold text-primary mb-3">poetry</h4>
                <p class="text-secondary text-sm mb-4">Поєднує керування залежностями, віртуальними середовищами та публікацію пакетів</p>
                <div class="code-block text-xs">
                  <pre><code># Додавання залежностей
poetry add torch transformers

# Додавання dev-залежностей
poetry add --group dev pytest black

# Запуск команд
poetry run python scripts/train.py</code></pre>
                </div>
              </div>

              <div>
                <h4 class="font-semibold text-primary mb-3">pipenv</h4>
                <p class="text-secondary text-sm mb-4">Інтеграція pip із віртуальними середовищами, автоматичне керування Pipfile</p>
                <div class="code-block text-xs">
                  <pre><code># Встановлення
pip install pipenv

# Встановлення залежностей
pipenv install

# Запуск команд
pipenv run python scripts/train.py

# Активація shell
pipenv shell</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Configuration Files -->
      <section id="configuration-files" class="py-16 bg-muted">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">6. Конфігураційні файли</h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            <div>
              <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Конфігурація тренування</h3>
              <div class="code-block text-sm">
                <pre><code># configs/training/example.yaml
experiment:
  name: &#34;whisper_finetune_ukrainian&#34;
  seed: 42

model:
  name: &#34;openai/whisper-base&#34;
  freeze_encoder: false
  dropout: 0.1

data:
  train:
    path: &#34;data/train&#34;
    batch_size: 16
    augmentation: true
  eval:
    path: &#34;data/eval&#34;
    batch_size: 32

optimizer:
  name: &#34;adamw&#34;
  lr: 1e-5
  weight_decay: 0.01

training:
  max_epochs: 10
  gradient_clip_val: 1.0</code></pre>
              </div>
            </div>

            <div>
              <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Конфігурація інференсу</h3>
              <div class="code-block text-sm">
                <pre><code># configs/inference/gpu_fast.yaml
inference:
  decoder:
    type: &#34;beam_search&#34;
    beam_size: 5
    patience: 2.0
    length_penalty: 1.0

device:
  type: &#34;cuda&#34;
  precision: &#34;fp16&#34;
  
  cuda:
    cudnn_benchmark: true
    allow_tf32: true

logging:
  logger: &#34;wandb&#34;
  wandb:
    project: &#34;asr-inference&#34;
    tags: [&#34;inference&#34;, &#34;ukrainian&#34;]</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white border rounded-lg p-8 shadow-sm">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Інтеграція з системами логування</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 class="font-semibold text-primary mb-4">Weights &amp; Biases</h4>
                <div class="code-block text-sm">
                  <pre><code>logging:
  logger: &#34;wandb&#34;
  wandb:
    project: &#34;asr-experiments&#34;
    entity: &#34;your-team&#34;
    name: &#34;${experiment.name}&#34;
    tags: [&#34;whisper&#34;, &#34;ukrainian&#34;]
    
    log_model: true
    log_freq: 100
    
    sweep:
      enabled: true
      method: &#34;bayes&#34;
      metric:
        name: &#34;val_wer&#34;
        goal: &#34;minimize&#34;</code></pre>
                </div>
              </div>
              <div>
                <h4 class="font-semibold text-primary mb-4">TensorBoard</h4>
                <div class="code-block text-sm">
                  <pre><code>logging:
  logger: &#34;tensorboard&#34;
  tensorboard:
    log_dir: &#34;logs/tensorboard&#34;
    flush_secs: 120
    histogram_freq: 0
    write_graph: false
    write_images: false
    
  console:
    level: &#34;INFO&#34;
    format: &#34;%(asctime)s - %(name)s - %(levelname)s - %(message)s&#34;
    
  file:
    enabled: true
    path: &#34;logs/training.log&#34;
    rotation: &#34;1 day&#34;</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Testing and CI/CD -->
      <section id="testing-ci" class="py-16">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">7. Тестування та безперервна інтеграція</h2>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <div class="flex items-center mb-4">
                <i class="fas fa-puzzle-piece text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">Модульні тести</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Перевірка окремих компонентів: обчислення WER, попередня обробка аудіо, валідація конфігурацій</p>
              <div class="code-block text-xs">
                <pre><code>def test_wer_perfect_match():
    &#34;&#34;&#34;WER для ідентичних текстів має бути 0.&#34;&#34;&#34;
    assert compute_wer(&#34;hello world&#34;, 
                      &#34;hello world&#34;) == 0.0

def test_mel_spectrogram_shape():
    &#34;&#34;&#34;Перевірка форми вихідної мел-спектрограми.&#34;&#34;&#34;
    audio = np.random.randn(16000)
    mel_spec = compute_mel_spectrogram(
        audio, sr=16000, n_mels=80
    )
    assert mel_spec.shape[0] == 80</code></pre>
              </div>
            </div>

            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <div class="flex items-center mb-4">
                <i class="fas fa-link text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">Інтеграційні тести</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Перевірка взаємодії компонентів: повний пайплайн транскрипції, тренування моделі</p>
              <div class="code-block text-xs">
                <pre><code>def test_full_transcription_pipeline(
    tiny_transcriber, sample_audio
):
    &#34;&#34;&#34;Перевірка повного циклу: аудіо → текст.&#34;&#34;&#34;
    result = tiny_transcriber.transcribe(
        sample_audio
    )
    assert result.text is not None
    assert len(result.text) &gt; 0
    assert 0 &lt;= result.confidence &lt;= 1</code></pre>
              </div>
            </div>

            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <div class="flex items-center mb-4">
                <i class="fas fa-tachometer-alt text-2xl text-primary mr-3"></i>
                <h3 class="font-serif text-xl font-semibold text-primary">Тести продуктивності</h3>
              </div>
              <p class="text-secondary text-sm mb-4">Вимірювання часу виконання: RTF (Real-Time Factor), ефективність пакетної обробки</p>
              <div class="code-block text-xs">
                <pre><code>def test_inference_speed(
    tiny_transcriber, sample_audio
):
    &#34;&#34;&#34;Перевірка, що інференс швидший за реальний час.&#34;&#34;&#34;
    audio_duration = 10.0
    start = time.perf_counter()
    tiny_transcriber.transcribe(sample_audio)
    elapsed = time.perf_counter() - start
    rtf = elapsed / audio_duration
    assert rtf &lt; 1.0</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white border rounded-lg p-8 shadow-sm">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">GitHub Actions для CI/CD</h3>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h4 class="font-semibold text-primary mb-4">Пайплайн тестування</h4>
                <div class="code-block text-sm">
                  <pre><code># .github/workflows/tests.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [&#34;3.9&#34;, &#34;3.10&#34;, &#34;3.11&#34;]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      
      - name: Cache pip packages
        uses: actions/cache@v3
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles(&#39;**/requirements*.txt&#39;) }}
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      
      - name: Run tests with coverage
        run: |
          pytest tests/ -v --cov=asr_system \
          --cov-report=xml --cov-report=term
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3</code></pre>
                </div>
              </div>

              <div>
                <h4 class="font-semibold text-primary mb-4">Пайплайн лінтингу</h4>
                <div class="code-block text-sm">
                  <pre><code># .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: &#34;3.10&#34;
      
      - name: Install tools
        run: pip install black ruff mypy
      
      - name: Check formatting with black
        run: black --check src/ tests/
      
      - name: Lint with ruff
        run: ruff check src/ tests/
      
      - name: Type check with mypy
        run: mypy src/</code></pre>
                </div>

                <h4 class="font-semibold text-primary mb-4 mt-6">Автоматична публікація</h4>
                <div class="code-block text-sm">
                  <pre><code># .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - &#39;v*&#39;

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build package
        run: python -m build
      
      - name: Publish to PyPI
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
        run: twine upload dist/*
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Repository Examples -->
      <section id="repository-examples" class="py-16 bg-muted">
        <div class="max-w-6xl mx-auto px-8">
          <h2 class="font-serif text-4xl font-bold text-primary mb-12">8. Приклади та шаблони з досліджуваних репозиторіїв</h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <h3 class="font-serif text-xl font-semibold mb-4 text-primary">noise-robust-asr</h3>
              <div class="flex items-center mb-4">
                <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">47% покращення WER</span>
                <span class="ml-2 text-sm text-secondary">у шумних умовах</span>
              </div>
              <p class="text-secondary text-sm mb-4">Демонструє класичний підхід до організації ASR-проекту з чітким розподілом відповідальності між компонентами. Реалізовано Docker-контейнеризацію та інтерактивну демонстрацію.</p>
              <div class="code-block text-xs">
                <pre><code>Структура:
├── src/
│   ├── models/      # Enhanced ASR models
│   ├── data/        # Обробка даних
│   ├── training/    # Логіка тренування
│   └── evaluation/  # Оцінювання
├── scripts/
│   └── run_universal_demo.py
├── configs/
├── notebooks/
└── Dockerfile</code></pre>
              </div>
              <a href="https://github.com/debanjan06/noise-robust-asr" class="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
                <i class="fab fa-github mr-1"></i> Переглянути репозиторій
              </a>
            </div>

            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <h3 class="font-serif text-xl font-semibold mb-4 text-primary">ctc-asr</h3>
              <div class="flex items-center mb-4">
                <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">WER 12.6%</span>
                <span class="ml-2 text-sm text-secondary">без мовної моделі</span>
              </div>
              <p class="text-secondary text-sm mb-4">Реалізує архітектури, натхненні Baidu Deep Speech, з використанням shell-скриптів для автоматизації. Детальна документація встановлення для різних платформ.</p>
              <div class="code-block text-xs">
                <pre><code>Особливості:
• train.sh для автоматизації
• Підтримка TensorFlow та CUDA
• TensorBoard для моніторингу
• Тренування на 900+ годин аудіо
• Архітектура Deep Speech 2</code></pre>
              </div>
              <a href="https://realpython.com/ref/best-practices/project-layout/" class="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
                <i class="fab fa-github mr-1"></i> Переглянути репозиторій
              </a>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <h3 class="font-serif text-xl font-semibold mb-4 text-primary">HISI-interface</h3>
              <div class="flex items-center mb-4">
                <span class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">CLI + Web UI</span>
                <span class="ml-2 text-sm text-secondary">два інтерфейси</span>
              </div>
              <p class="text-secondary text-sm mb-4">Модульна архітектура з core/, backends/, handlers/, web/. Підтримка MLX Whisper для Apple Silicon та офіційного Whisper OpenAI. Формалізований процес внеску.</p>
              <div class="code-block text-xs">
                <pre><code>Архітектура:
├── core/       # Бізнес-логіка
├── backends/   # Адаптери для різних ASR
├── handlers/   # Обробники запитів
└── web/        # Веб-інтерфейс

Команда CLI:
python -m hisi transcribe audio.wav</code></pre>
              </div>
              <a href="https://github.com/Diabolocom-Research/HISI-interface" class="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
                <i class="fab fa-github mr-1"></i> Переглянути репозиторій
              </a>
            </div>

            <div class="bg-white border rounded-lg p-6 shadow-sm">
              <h3 class="font-serif text-xl font-semibold mb-4 text-primary">Qwen3-ASR-Toolkit</h3>
              <div class="flex items-center mb-4">
                <span class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">SRT + Багатопотоковість</span>
                <span class="ml-2 text-sm text-secondary">підтримка субтитрів</span>
              </div>
              <p class="text-secondary text-sm mb-4">Приклади використання з різними параметрами командного рядка. Підтримка SRT-субтитрів та багатопотокової обробки для ефективного використання багатоядерних процесорів.</p>
              <div class="code-block text-xs">
                <pre><code>Функції:
• Багатопотокова обробка
• Формат виходу SRT/VTT
• Постобробка результатів
• Інтеграція з різними API
• Оптимізація продуктивності</code></pre>
              </div>
              <a href="https://github.com/debanjan06/noise-robust-asr" class="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
                <i class="fab fa-github mr-1"></i> Переглянути репозиторій
              </a>
            </div>
          </div>

          <div class="mt-12 bg-white border rounded-lg p-8 shadow-sm">
            <h3 class="font-serif text-2xl font-semibold mb-6 text-primary">Ключові уроки та рекомендації</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 class="font-semibold text-primary mb-4">Архітектурні рішення</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Чітке розділення відповідальності між компонентами</li>
                  <li>• Модульна структура з src/, scripts/, configs/</li>
                  <li>• Підтримка кількох бекендів через адаптери</li>
                  <li>• Інкапсуляція логіки тренування та інференсу</li>
                </ul>

                <h4 class="font-semibold text-primary mb-4 mt-6">Якість коду</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Автоматизовані перевірки через pre-commit</li>
                  <li>• Статична типізація з mypy</li>
                  <li>• Єдиний стиль форматування з black</li>
                  <li>• Комплексне тестування з pytest</li>
                </ul>
              </div>
              <div>
                <h4 class="font-semibold text-primary mb-4">Документація та користувацький досвід</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Детальна документація з прикладами</li>
                  <li>• Інтерактивні демонстрації</li>
                  <li>• CLI та API інтерфейси</li>
                  <li>• Візуалізація результатів та метрик</li>
                </ul>

                <h4 class="font-semibold text-primary mb-4 mt-6">Розгортання та ізоляція</h4>
                <ul class="space-y-2 text-sm text-secondary">
                  <li>• Підтримка Docker та Docker Compose</li>
                  <li>• Конфігурація для різних середовищ</li>
                  <li>• Віртуальні середовища з venv/Conda</li>
                  <li>• Автоматизоване тестування в CI/CD</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="py-16 bg-primary text-white">
        <div class="max-w-4xl mx-auto px-8 text-center">
          <h3 class="font-serif text-2xl font-bold mb-4">Готові до створення професійної ASR системи?</h3>
          <p class="text-lg text-gray-300 mb-8">
            Використовуйте цей посібник для створення добре організованого, документованого та підтримуваного репозиторію ASR системи
          </p>
          <div class="flex justify-center space-x-6">
            <a href="https://github.com/debanjan06/noise-robust-asr" class="text-gray-300 hover:text-white">
              <i class="fab fa-github text-2xl"></i>
            </a>
            <a href="#" class="text-gray-300 hover:text-white">
              <i class="fas fa-book text-2xl"></i>
            </a>
            <a href="#" class="text-gray-300 hover:text-white">
              <i class="fas fa-code text-2xl"></i>
            </a>
          </div>
        </div>
      </footer>
    </div>

    <script>
        // Mobile TOC Toggle
        document.getElementById('toc-toggle').addEventListener('click', function() {
            const toc = document.getElementById('toc');
            toc.classList.toggle('mobile-open');
        });

        // Smooth scrolling for TOC links
        document.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const offsetTop = targetElement.offsetTop - 20;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                    
                    // Close mobile TOC
                    if (window.innerWidth <= 1024) {
                        document.getElementById('toc').classList.remove('mobile-open');
                    }
                }
            });
        });

        // Active TOC link highlighting
        function updateActiveTOCLink() {
            const sections = document.querySelectorAll('section[id]');
            const tocLinks = document.querySelectorAll('.toc-link');
            
            let currentSection = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop - 100;
                const sectionBottom = sectionTop + section.offsetHeight;
                
                if (window.scrollY >= sectionTop && window.scrollY < sectionBottom) {
                    currentSection = section.getAttribute('id');
                }
            });
            
            tocLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + currentSection) {
                    link.classList.add('active');
                }
            });
        }

        // Update active TOC link on scroll
        window.addEventListener('scroll', updateActiveTOCLink);
        window.addEventListener('load', updateActiveTOCLink);
        
        // Close mobile TOC when clicking outside
        document.addEventListener('click', function(event) {
            const toc = document.getElementById('toc');
            const toggle = document.getElementById('toc-toggle');
            
            if (!toc.contains(event.target) && !toggle.contains(event.target)) {
                toc.classList.remove('mobile-open');
            }
        });
    </script>
  

</body></html>
