# CSV data audit

```json
{
  "rowCount": 3,
  "columnCount": 3,
  "columns": [
    {
      "name": "item",
      "missing": 0,
      "present": 3,
      "numericCount": 0
    },
    {
      "name": "units",
      "missing": 0,
      "present": 3,
      "numericCount": 3,
      "sum": "20",
      "min": "4",
      "max": "10",
      "mean": "6.666666",
      "meanPrecision": "truncated toward zero to 6 decimals",
      "scope": "all non-empty cells"
    },
    {
      "name": "unit_price",
      "missing": 0,
      "present": 3,
      "numericCount": 3,
      "sum": "4",
      "min": "0.3",
      "max": "2.5",
      "mean": "1.333333",
      "meanPrecision": "truncated toward zero to 6 decimals",
      "scope": "all non-empty cells"
    }
  ]
}
```


Statistics describe the submitted data; they do not establish that the data is accurate.
