import { Fragment } from "react";

// A URL that wraps after its slashes rather than mid-word; overflow-wrap is only the last resort.
export function UrlText({ url, stripScheme = true }) {
  const text = stripScheme ? url.replace(/^https?:\/\//, "") : url;
  return (
    <span className="[overflow-wrap:anywhere]">
      {text.split("/").map((part, i) => (
        <Fragment key={i}>
          {i > 0 && "/"}
          {i > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
