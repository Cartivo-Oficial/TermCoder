import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Btn } from "./Btn";
import { Chip } from "./Chip";
import { Panel } from "./Panel";
import { Row } from "./Row";

describe("Row", () => {
  it("is a div by default", () => {
    expect(renderToStaticMarkup(<Row>x</Row>)).toContain("<div");
  });

  it("renders a real button when asked, keeping its attributes", () => {
    const html = renderToStaticMarkup(
      <Row as="button" aria-label="pick" disabled>x</Row>,
    );
    expect(html).toContain("<button");
    expect(html).toContain('aria-label="pick"');
    expect(html).toContain("disabled");
  });
});

describe("Panel", () => {
  it("marks the selected state", () => {
    expect(renderToStaticMarkup(<Panel selected>x</Panel>)).toContain("is-selected");
  });

  it("renders a button when asked", () => {
    expect(renderToStaticMarkup(<Panel as="button">x</Panel>)).toContain("<button");
  });
});

describe("Btn", () => {
  it("has a tone that fills with the text colour, distinct from the accent one", () => {
    expect(renderToStaticMarkup(<Btn tone="strong">x</Btn>)).toContain("u-btn-strong");
    expect(renderToStaticMarkup(<Btn tone="solid">x</Btn>)).toContain("u-btn-solid");
  });
});

describe("Chip", () => {
  it("is a button that announces its pressed state when interactive", () => {
    const html = renderToStaticMarkup(<Chip interactive on onClick={() => {}}>x</Chip>);
    expect(html).toContain("<button");
    expect(html).toContain('aria-pressed="true"');
  });

  it("is a plain span when it is only a label", () => {
    const html = renderToStaticMarkup(<Chip>x</Chip>);
    expect(html).toContain("<span");
    expect(html).not.toContain("aria-pressed");
  });
});
