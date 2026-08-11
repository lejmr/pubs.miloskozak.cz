{{ printf "---\ntitle: %q\ndate: %s\n---\n\n" .Title (.Date.Format "2006-01-02") }}{{ .RawContent }}
