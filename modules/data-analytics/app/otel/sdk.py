from os import environ, pathsep, getcwd
from os.path import abspath, dirname
from app.setting import ENABLE_OPENTELEMETRY
import opentelemetry.instrumentation.auto_instrumentation

# Optionally initialize OTel, by importing this file first
if ENABLE_OPENTELEMETRY:
    # Instrument packages through prefixed `PYTHONPATH` that includes instrumented packages first
    python_path = environ.get("PYTHONPATH")

    if not python_path:
        python_path = []
    else:
        python_path = python_path.split(pathsep)

    cwd_path = getcwd()

    # This is being added to support applications that are being run from their
    # own executable, like Django.
    # FIXME investigate if there is another way to achieve this
    if cwd_path not in python_path:
        python_path.insert(0, cwd_path)

    filedir_path = dirname(abspath(opentelemetry.instrumentation.auto_instrumentation.__file__))

    python_path = [path for path in python_path if path != filedir_path]

    python_path.insert(0, filedir_path)

    environ["PYTHONPATH"] = pathsep.join(python_path)

    # Initialize OTel components via ENV variables
    # (tracer provider, meter provider, logger provider, processors, exporters, etc.)
    from opentelemetry.instrumentation.auto_instrumentation import sitecustomize  # noqa: F401
