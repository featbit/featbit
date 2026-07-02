# Install python 3.9 with miniconda

# list all conda envs

```bash
conda env list
```

# Activate conda env
```bash
conda activate data-analytics
```

# install dependencies
```bash
pip install -r requirements.txt
```

# Run migrations
```bash
flask migrate-database
```

# Launch APP

# Create fake data

```bash
python intergration_tests/insert_fake_ff_events.py
```

```bash
python intergration_tests/insert_fake_metric_events.py
```
