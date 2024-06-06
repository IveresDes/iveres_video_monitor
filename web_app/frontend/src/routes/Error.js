import { useRouteError } from "react-router-dom";
import Header from "../components/Header";

export default function Error() {
  const error = useRouteError();
  console.error(error);

  return (
    <div>
      <Header />
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
}
