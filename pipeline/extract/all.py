"""Rebuild every processed dataset from the two PDFs: `uv run python -m extract.all`."""
from extract import detailed_lines, summary_tables


def main() -> None:
    print("detailed_lines:", detailed_lines.main())
    print("summary_tables:", summary_tables.main())


if __name__ == "__main__":
    main()
