"""Rebuild every processed dataset from the two PDFs: `uv run python -m extract.all`."""
from extract import dept_tables, detailed_lines, narrative_chunks, revenues, summary_tables


def main() -> None:
    print("detailed_lines:", detailed_lines.main())
    print("summary_tables:", summary_tables.main())
    print("dept_tables:", dept_tables.main())
    print("revenues:", revenues.main())
    print("narrative_chunks:", narrative_chunks.main())


if __name__ == "__main__":
    main()
