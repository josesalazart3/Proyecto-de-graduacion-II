# ---- Build automático multi-etapa: SDK → runtime ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY . .
RUN dotnet restore Sciad.sln
RUN dotnet publish src/Sciad.Api/Sciad.Api.csproj -c Release -o /app/publish

# ---- Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
# curl lo exige el healthcheck del docker-compose (no viene en la imagen aspnet por defecto)
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Sciad.Api.dll"]
