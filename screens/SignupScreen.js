const handleSignup = async () => {
  const res = await fetch(`${BACKEND_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (data.status === "success") {
    Alert.alert("Success", "Check your email!");
    navigation.goBack();
  } else {
    Alert.alert("Error", data.message);
  }
};