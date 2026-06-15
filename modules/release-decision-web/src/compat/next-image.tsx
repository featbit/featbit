import { forwardRef } from "react";

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
};

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { priority: _priority, ...props },
  ref,
) {
  return <img ref={ref} {...props} />;
});

export default Image;
