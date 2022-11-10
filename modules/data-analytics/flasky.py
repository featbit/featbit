
import os

from dotenv import load_dotenv
load_dotenv()

if os.getenv('FLASK_APP', None):
    from app import get_app
    app = get_app(os.getenv('FLASK_CONFIG', 'default'))

if __name__ == '__main__':
    if app is not None:
        app.run(port=10000)
